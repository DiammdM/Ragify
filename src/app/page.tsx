'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useLanguage } from '@/components/language-provider';

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

type InteractionStatus = 'loading' | 'ready' | 'error';

type Interaction = {
  id: string;
  question: string;
  results: ChunkResult[];
  status: InteractionStatus;
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
  id: typeof result.id === 'string' ? result.id : fallbackId,
  content: typeof result.content === 'string' ? result.content.trim() : '',
  documentName:
    typeof result.documentName === 'string' ? result.documentName : null,
  documentId:
    typeof result.documentId === 'string' ? result.documentId : null,
  chunkIndex:
    typeof result.chunkIndex === 'number' && Number.isFinite(result.chunkIndex)
      ? result.chunkIndex
      : null,
  score:
    typeof result.score === 'number' && Number.isFinite(result.score)
      ? result.score
      : 0,
  vectorScore:
    typeof result.vectorScore === 'number' && Number.isFinite(result.vectorScore)
      ? result.vectorScore
      : null,
  crossScore:
    typeof result.crossScore === 'number' && Number.isFinite(result.crossScore)
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
  if (!answer || typeof answer !== 'object') {
    return null;
  }

  const text =
    typeof answer.text === 'string' && answer.text.trim().length > 0
      ? answer.text.trim()
      : '';

  const provider =
    typeof answer.provider === 'string' && answer.provider.length > 0
      ? answer.provider
      : null;

  const model =
    typeof answer.model === 'string' && answer.model.length > 0
      ? answer.model
      : null;

  if (!text && !provider && !model) {
    return null;
  }

  return { text, provider, model };
};


export default function Home() {
  const { t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const suggestions = useMemo(() => t.qa.quickQuestions, [t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    const pendingId = `${Date.now()}`;

    setHistory((prev) => [
      ...prev,
      {
        id: pendingId,
        question: trimmed,
        results: [],
        status: 'loading',
      },
    ]);
    setQuestion('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const data: ApiResponse = await response.json();
      if (!response.ok) {
        const message =
          typeof data.error === 'string' && data.error
            ? data.error
            : t.qa.errorFallback;
        throw new Error(message);
      }

      const matches = normalizeResults(data.results);
      const answerPayload = normalizeAnswer(data.answer);
      const answerError =
        typeof data.answerError === 'string' && data.answerError.length > 0
          ? data.answerError
          : null;
      setHistory((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                results: matches,
                answer: answerPayload?.text ?? '',
                answerProvider: answerPayload?.provider ?? null,
                answerModel: answerPayload?.model ?? null,
                answerError,
                status: 'ready',
              }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to query knowledge base', error);
      const message =
        error instanceof Error ? error.message : t.qa.errorFallback;
      setHistory((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                status: 'error',
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
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
      <div className="rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-violet-900/20 backdrop-blur">
        <div className="flex flex-col gap-6 pb-8">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">{t.qa.title}</h2>
            <p className="mt-2 text-base text-slate-200/80 sm:text-lg">{t.qa.subtitle}</p>
          </div>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-3">
              <span className="sr-only">{t.qa.placeholder}</span>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t.qa.placeholder}
                rows={5}
                className="w-full rounded-[28px] border border-white/10 bg-slate-950/70 p-5 text-base text-white shadow-inner shadow-violet-600/10 outline-none transition focus:border-violet-300/70 focus:bg-slate-950 focus:shadow-violet-500/30"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex max-w-xl flex-wrap gap-3">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQuestion(item)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:border-violet-300/70 hover:text-white"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-violet-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? t.qa.processing : t.qa.ask}
              </button>
            </div>
          </form>
        </div>
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-purple-200/90">
              {t.qa.historyLabel}
            </h3>
            <p className="text-xs text-slate-300/70">{t.qa.note}</p>
          </div>
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-950/60 p-8 text-center text-sm text-slate-300/70">
                {t.qa.emptyState}
              </div>
            ) : (
              history.map((item) => (
                <article
                  key={item.id}
                  className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-inner shadow-slate-950/40"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-purple-200/80">{t.qa.ask}</p>
                    <p className="mt-1 text-base text-white/90">{item.question}</p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-slate-950/80 p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                      {t.qa.answerTitle}
                    </p>
                    {item.status === 'loading' ? (
                      <p className="text-sm leading-relaxed text-slate-400/70 animate-pulse">
                        {t.qa.answerLoading}
                      </p>
                    ) : item.status === 'error' ? (
                      <p className="text-sm leading-relaxed text-rose-200">{item.error ?? t.qa.errorFallback}</p>
                    ) : item.answerError ? (
                      <p className="text-sm leading-relaxed text-rose-200">{item.answerError}</p>
                    ) : item.answer ? (
                      <>
                        <p className="text-sm leading-relaxed text-slate-100 whitespace-pre-line">{item.answer}</p>
                        {(item.answerModel || item.answerProvider) && (
                          <p className="mt-3 text-xs uppercase tracking-[0.35em] text-slate-500">
                            {t.qa.answerModelLabel}:{' '}
                            {[item.answerModel, item.answerProvider].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm leading-relaxed text-slate-300/80">{t.qa.answerEmpty}</p>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
      <aside className="flex flex-col gap-5 rounded-[32px] border border-white/10 bg-slate-900/50 p-7 shadow-2xl shadow-slate-950/30">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
          <h3 className="text-base font-semibold text-white/90">{t.qa.samplesTitle}</h3>
          <p className="mt-3 text-sm text-slate-300/80">{t.qa.note}</p>
        </div>
        <div className="rounded-[28px] border border-dashed border-violet-400/40 bg-violet-500/10 p-6 text-sm text-violet-100">
          <p>{t.library.chunkingNote}</p>
        </div>
      </aside>
    </section>
  );
}
