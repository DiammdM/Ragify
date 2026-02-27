"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { dedupeBySourceName, getSourceLabel } from "@/lib/source-label";
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
  source: string | null;
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
  source: typeof result.source === "string" ? result.source : null,
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
  const normalized = results.map((result, index) =>
    toChunkResult(result, `result-${timestamp}-${index}`),
  );

  return dedupeBySourceName(normalized);
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
    [language],
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
            : item,
        ),
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
            : item,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className="flat-surface-1 relative flex flex-col gap-8 overflow-hidden"
      style={{ height: "min(794px, calc(100vh - 220px))" }}
    >
      <div className="scrollbar-dark flex flex-1 flex-col p-6 text-foreground sm:p-8">
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
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={t.qa.placeholder}
                rows={1}
                className="w-full min-h-[52px] rounded-[10px] border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:focus:border-violet-300/70 dark:focus:ring-violet-500/30"
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
                          className="chip-pressable h-[42px] w-full items-center justify-start rounded-xl border border-border bg-background/70 px-4 text-left text-sm font-semibold text-foreground/80 hover:border-ring hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-violet-300/70 dark:hover:text-white"
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
                className="font-semibold"
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
              <div className="rounded-[16px] border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-950/60">
                {t.qa.emptyState}
              </div>
            ) : (
              [...history]
                .slice()
                .reverse()
                .map((item) => (
                  <article
                    key={item.id}
                    className="space-y-4 rounded-[16px] border border-border bg-card p-6 transition-colors duration-200 dark:border-white/10 dark:bg-slate-950/70"
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
                      {item.status === "ready" && (
                        <div className="mt-3 border-t border-border/70 pt-2 dark:border-white/10">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                            {t.chat.referencesTitle}
                          </p>
                          {item.results.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {item.results.map((result) => {
                                return (
                                  <li
                                    key={result.id}
                                    className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-slate-900/50"
                                  >
                                    <p className="font-medium text-foreground">
                                      {getSourceLabel(result)}
                                    </p>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t.chat.referencesEmpty}
                            </p>
                          )}
                        </div>
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
