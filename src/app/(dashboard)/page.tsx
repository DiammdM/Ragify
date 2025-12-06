"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ChunkResult = {
  id: string;
  content: string;
  documentName: string | null;
  documentId: string | null;
  chunkIndex: number | null;
  score: number;
  vectorScore?: number | null;
  crossScore?: number | null;
};

type InteractionStatus = "loading" | "ready" | "error";

type Interaction = {
  id: string;
  question: string;
  results: ChunkResult[];
  status: InteractionStatus;
  createdAt: number;
  error?: string;
  answer?: string;
  answerProvider?: string | null;
  answerModel?: string | null;
  answerError?: string | null;
};

type ApiResult = Partial<ChunkResult> & {
  id?: string;
};

type ApiAnswer =
  | {
      text?: string;
      provider?: string | null;
      model?: string | null;
    }
  | null
  | undefined;

type ApiResponse = {
  results?: ApiResult[];
  answer?: ApiAnswer;
  answerError?: string | null;
  error?: string;
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
  vectorScore:
    typeof result.vectorScore === "number" &&
    Number.isFinite(result.vectorScore)
      ? result.vectorScore
      : null,
  crossScore:
    typeof result.crossScore === "number" && Number.isFinite(result.crossScore)
      ? result.crossScore
      : null,
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

const normalizeAnswer = (answer?: ApiAnswer) => {
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

export default function Home() {
  const { t, language } = useLanguage();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<string[] | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => {
    if (!customPrompts) {
      return [];
    }
    return customPrompts
      .slice(0, 3)
      .map((item) => (typeof item === "string" ? item : ""))
      .filter((item) => item.trim().length > 0);
  }, [customPrompts]);
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [language]
  );
  const HISTORY_LIMIT = 20;

  useEffect(() => {
    const node = historyRef.current;
    if (!node) return;
    node.scrollTo({ top: 0, behavior: "smooth" });
  }, [history]);

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const response = await fetch("/api/settings/model", {
          method: "GET",
        });
        if (!response.ok) {
          return;
        }
        const data: { settings?: { quickPrompts?: unknown } | null } =
          await response.json();
        if (data.settings && Array.isArray(data.settings.quickPrompts)) {
          const normalized = data.settings.quickPrompts
            .slice(0, 3)
            .map((item) => (typeof item === "string" ? item : ""))
            .map((item) => item ?? "");
          if (normalized.some((item) => item.trim().length > 0)) {
            setCustomPrompts(normalized);
          }
        }
      } catch (error) {
        console.error("Failed to load quick prompts", error);
      }
    };

    void loadPrompts();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    const pendingId = `${Date.now()}`;

    setHistory((prev) => {
      const next = [
        ...prev,
        {
          id: pendingId,
          question: trimmed,
          results: [],
          status: "loading",
          createdAt: Date.now(),
        },
      ];
      return next.slice(-HISTORY_LIMIT);
    });
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const data: ApiResponse = await response.json();
      if (!response.ok) {
        const message =
          typeof data.error === "string" && data.error
            ? data.error
            : t.qa.errorFallback;
        throw new Error(message);
      }

      const matches = normalizeResults(data.results);
      const answerPayload = normalizeAnswer(data.answer);
      const answerError =
        typeof data.answerError === "string" && data.answerError.length > 0
          ? data.answerError
          : null;
      setHistory((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                results: matches,
                answer: answerPayload?.text ?? "",
                answerProvider: answerPayload?.provider ?? null,
                answerModel: answerPayload?.model ?? null,
                answerError,
                status: "ready",
              }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to query knowledge base", error);
      const message =
        error instanceof Error ? error.message : t.qa.errorFallback;
      setHistory((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                status: "error",
                error: message,
              }
            : item
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className="relative flex flex-col gap-8 overflow-hidden rounded-[32px] shadow-xl shadow-slate-900/10 backdrop-blur animate-slide-up"
      style={{ height: "min(794px, calc(100vh - 220px))" }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-violet-500/60 via-indigo-400/40 to-transparent" />
      <div className="scrollbar-dark flex flex-1 flex-col rounded-[32px] border border-border bg-card/90 p-8 text-foreground shadow-xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-violet-900/20">
        <div className="flex flex-col gap-6 pb-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              {t.qa.title}
            </h2>
          </div>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-3">
              <span className="sr-only">{t.qa.placeholder}</span>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t.qa.placeholder}
                rows={1}
                className="w-full min-h-[52px] rounded-[20px] border border-border bg-card px-4 py-3 text-base text-foreground shadow-inner shadow-slate-950/5 outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:shadow-violet-600/10 dark:focus:border-violet-300/70 dark:focus:ring-violet-500/30"
              />
            </label>
            <div
              className={`flex items-center gap-4 ${
                suggestions.length > 0 ? "justify-between" : "justify-end"
              }`}
            >
              {suggestions.length > 0 && (
                <div className="grid w-full max-w-3xl grid-cols-3 gap-3">
                  {suggestions.map((item, index) => (
                    <Tooltip key={`${item}-${index}`}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQuestion(item)}
                          className="chip-pressable h-[42px] w-full items-center justify-start rounded-2xl border-border bg-background/70 px-4 text-left text-sm font-semibold text-foreground/80 shadow-sm transition hover:border-ring hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-violet-300/70 dark:hover:text-white"
                        >
                          <span className="block w-full truncate">{item}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        className="max-w-xs"
                      >
                        {item}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                variant="cta"
                size="pill"
                className={`font-semibold ${
                  isLoading ? "" : "animate-glow-soft"
                }`}
              >
                {isLoading ? t.qa.processing : t.qa.ask}
              </Button>
            </div>
          </form>
        </div>
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              {t.qa.historyLabel}
            </h3>
            <p className="text-xs text-muted-foreground">{t.qa.note}</p>
          </div>
          <div
            ref={historyRef}
            className="scrollbar-dark space-y-4 overflow-y-auto pr-1"
            style={{ maxHeight: "452px" }}
          >
            {history.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/60">
                {t.qa.emptyState}
              </div>
            ) : (
              [...history]
                .slice()
                .reverse()
                .map((item) => (
                  <article
                    key={item.id}
                    className="space-y-4 rounded-[28px] border border-border bg-card p-6 shadow-inner shadow-slate-900/5 transition duration-200 animate-slide-up dark:border-white/10 dark:bg-slate-950/70 dark:shadow-slate-950/40"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        {t.qa.ask}
                      </p>
                      <p className="mt-1 text-base text-foreground">
                        {item.question}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/40 p-5 dark:border-white/5 dark:bg-slate-950/80">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-200/80">
                        {t.qa.answerTitle}
                      </p>
                      {item.status === "loading" ? (
                        <p className="text-sm leading-relaxed text-muted-foreground animate-pulse">
                          {t.qa.answerLoading}
                        </p>
                      ) : item.status === "error" ? (
                        <p className="text-sm leading-relaxed text-rose-500 dark:text-rose-200">
                          {item.error ?? t.qa.errorFallback}
                        </p>
                      ) : item.answerError ? (
                        <p className="text-sm leading-relaxed text-rose-500 dark:text-rose-200">
                          {item.answerError}
                        </p>
                      ) : item.answer ? (
                        <>
                          <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                            {item.answer}
                          </p>
                          {(item.answerModel || item.answerProvider) && (
                            <p className="mt-3 text-xs uppercase tracking-[0.35em] text-muted-foreground">
                              {t.qa.answerModelLabel}:{" "}
                              {[item.answerModel, item.answerProvider]
                                .filter(Boolean)
                                .join(" · ")}
                              <span className="float-right text-[11px] text-muted-foreground normal-case">
                                {timeFormatter.format(item.createdAt)}
                              </span>
                            </p>
                          )}
                          {!item.answerModel && !item.answerProvider && (
                            <p className="mt-3 text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                              <span className="float-right text-[11px] text-muted-foreground normal-case">
                                {timeFormatter.format(item.createdAt)}
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {t.qa.answerEmpty}
                        </p>
                      )}
                    </div>
                  </article>
                ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
