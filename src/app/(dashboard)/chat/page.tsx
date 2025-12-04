"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
      className="relative flex flex-col overflow-hidden rounded-[32px] shadow-xl shadow-slate-900/10 backdrop-blur"
      style={{ height: "min(794px, calc(100vh - 220px))" }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-emerald-400/40 via-cyan-300/30 to-transparent" />
      <div className="flex h-full flex-col rounded-[32px] border border-border bg-card/90 p-8 text-foreground shadow-xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-white dark:shadow-violet-900/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              {t.chat.title}
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isSending || messages.length === 0}
            className="rounded-full border-border bg-background/80 text-sm font-semibold text-foreground/80 shadow-sm transition hover:border-red-300/60 hover:bg-muted hover:text-foreground disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-red-300/50 dark:hover:text-white"
          >
            {t.chat.clear}
          </Button>
        </div>

        <div className="mt-6 grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-4">
          <div
            ref={viewportRef}
            className="scrollbar-dark flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[28px] border border-border bg-muted/50 p-5 dark:border-white/10 dark:bg-slate-950/60"
          >
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/50">
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
                          ? "border-violet-200 bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-violet-500/30"
                          : "border-border bg-card text-foreground shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-white/90 dark:shadow-slate-950/30"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-line">
                        {isLoading ? (
                          <div className="flex items-center gap-1 text-foreground/80">
                            {[0, 1, 2].map((index) => (
                              <span
                                key={index}
                                className="inline-block size-2 rounded-full bg-foreground/70 animate-bounce"
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
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 rounded-[28px] border border-border bg-card p-4 shadow-inner shadow-slate-900/5 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-violet-600/10">
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
                className="w-full resize-none rounded-2xl border border-border bg-card p-3 text-sm text-foreground shadow-inner shadow-slate-900/5 outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 dark:border-white/10 dark:bg-slate-950/90 dark:text-white dark:shadow-violet-500/15 dark:focus:border-violet-300/70 dark:focus:ring-violet-500/30"
                disabled={isSending}
              />
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
