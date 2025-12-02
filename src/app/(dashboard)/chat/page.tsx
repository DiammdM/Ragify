"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";

type ChunkResult = {
  id: string;
  content: string;
  documentName: string | null;
  documentId: string | null;
  chunkIndex: number | null;
  score: number;
};

type ApiResult = Partial<ChunkResult> & { id?: string };

type AnswerPayload = {
  text?: string;
  provider?: string | null;
  model?: string | null;
} | null;

type ApiResponse = {
  results?: ApiResult[];
  answer?: AnswerPayload;
  answerError?: string | null;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "loading" | "ready" | "error";
  error?: string | null;
  results?: ChunkResult[];
  answerProvider?: string | null;
  answerModel?: string | null;
};

const toChunkResult = (result: ApiResult, fallbackId: string): ChunkResult => ({
  id: typeof result.id === "string" ? result.id : fallbackId,
  content: typeof result.content === "string" ? result.content.trim() : "",
  documentName:
    typeof result.documentName === "string" ? result.documentName : null,
  documentId: typeof result.documentId === "string" ? result.documentId : null,
  chunkIndex:
    typeof result.chunkIndex === "number" && Number.isFinite(result.chunkIndex)
      ? result.chunkIndex
      : null,
  score:
    typeof result.score === "number" && Number.isFinite(result.score)
      ? result.score
      : 0,
});

const normalizeResults = (results?: ApiResult[]) => {
  if (!Array.isArray(results)) {
    return [];
  }
  const timestamp = Date.now();
  return results.map((result, index) =>
    toChunkResult(result, `result-${timestamp}-${index}`)
  );
};

const normalizeAnswer = (answer?: AnswerPayload) => {
  if (!answer || typeof answer !== "object") {
    return null;
  }

  const text =
    typeof answer.text === "string" && answer.text.trim().length > 0
      ? answer.text.trim()
      : "";

  const provider =
    typeof answer.provider === "string" && answer.provider.length > 0
      ? answer.provider
      : null;

  const model =
    typeof answer.model === "string" && answer.model.length > 0
      ? answer.model
      : null;

  if (!text && !provider && !model) {
    return null;
  }

  return { text, provider, model };
};

export default function ChatPage() {
  const { t } = useLanguage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = useMemo(
    () => t.chat.quickPrompts,
    [t.chat.quickPrompts]
  );

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const submitMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const assistantId = `assistant-${Date.now() + 1}`;

    const payloadMessages = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", status: "loading" },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        const message =
          (data && typeof data.error === "string" && data.error) ||
          t.chat.answerError;
        throw new Error(message);
      }

      const matches = normalizeResults(data.results);
      const answerPayload = normalizeAnswer(data.answer);
      const answerError =
        typeof data.answerError === "string" && data.answerError.length > 0
          ? data.answerError
          : null;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                status: answerError ? "error" : "ready",
                error: answerError,
                content: answerPayload?.text ?? "",
                results: matches,
                answerProvider: answerPayload?.provider ?? null,
                answerModel: answerPayload?.model ?? null,
              }
            : message
        )
      );
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : t.chat.answerError;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                status: "error",
                error: fallback,
                content: "",
              }
            : message
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitMessage();
  };

  const handleClear = () => {
    if (isSending) return;
    setMessages([]);
    setInput("");
  };

  return (
    <section
      className="flex flex-col overflow-hidden"
      style={{ height: "min(794px, calc(100vh - 220px))" }}
    >
      <div className="flex h-full flex-col rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-violet-900/20 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              {t.chat.title}
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isSending || messages.length === 0}
            className="rounded-full border-white/10 bg-white/5 text-sm font-semibold text-white/80 transition hover:border-red-300/50 hover:text-white disabled:opacity-60"
          >
            {t.chat.clear}
          </Button>
        </div>

        <div className="mt-6 grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-4">
          <div
            ref={viewportRef}
            className="scrollbar-dark flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[28px] border border-white/10 bg-slate-950/60 p-5"
          >
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-6 text-sm text-slate-300/70">
                {t.chat.emptyState}
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                const isLoading = message.status === "loading";
                const isError = message.status === "error";

                return (
                  <div
                    key={message.id}
                    className={`flex w-full ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[82%] rounded-xl border px-3 py-2 shadow ${
                        isUser
                          ? "border-violet-300/60 bg-gradient-to-r from-violet-500 to-indigo-500 text-slate-950 shadow-violet-500/30"
                          : "border-white/10 bg-slate-900/70 text-white/90 shadow-slate-950/30"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-line">
                        {isLoading ? (
                          <div className="flex items-center gap-1 text-white/80">
                            {[0, 1, 2].map((index) => (
                              <span
                                key={index}
                                className="inline-block size-2 rounded-full bg-white/70 animate-bounce"
                                style={{ animationDelay: `${index * 120}ms` }}
                              />
                            ))}
                          </div>
                        ) : isError ? (
                          message.error || t.chat.answerError
                        ) : (
                          message.content || t.chat.answerFallback
                        )}
                      </div>
                      {!isUser && (
                        <div className="mt-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-white/50">
                          {isError ? (
                            <span>{t.chat.answerError}</span>
                          ) : (
                            <>
                              {message.answerModel && (
                                <span>{message.answerModel}</span>
                              )}
                              {message.answerProvider && (
                                <span>{message.answerProvider}</span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 rounded-[28px] border border-white/10 bg-slate-950/70 p-4 shadow-inner shadow-violet-600/10">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
                placeholder={t.chat.placeholder}
                rows={2}
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/90 p-3 text-sm text-white shadow-inner shadow-violet-500/15 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
                disabled={isSending}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(prompt)}
                    className="h-auto rounded-full border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:border-violet-300/70 hover:text-white"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
