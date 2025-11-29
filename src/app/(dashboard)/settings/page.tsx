'use client';

import { FormEvent, useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Select } from '@/components/select';

const MODEL_ORDER = ['llama', 'qwen', 'gemma', 'ollama'] as const;

type ModelKey = (typeof MODEL_ORDER)[number];

export default function SettingsPage() {
  const { t } = useLanguage();
  const [selectedModel, setSelectedModel] = useState<ModelKey>('llama');
  const [apiKey, setApiKey] = useState('');
  const [chunkSize, setChunkSize] = useState(800);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ollamaHost, setOllamaHost] = useState('127.0.0.1');
  const [ollamaPort, setOllamaPort] = useState('11434');
  const [ollamaModel, setOllamaModel] = useState('gpt-oss:20b');

  const modelOptions = MODEL_ORDER.map((key) => ({
    value: key,
    label: t.settings.models[key],
  }));

  const showOllamaFields = selectedModel === 'ollama';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(t.settings.saved);
    setTimeout(() => setFeedback(null), 2600);
  };

  return (
    <section className="space-y-7 rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-violet-900/20 backdrop-blur">
      <header className="space-y-3">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">{t.settings.title}</h2>
        <p className="text-base text-slate-200/80">{t.settings.subtitle}</p>
      </header>

      <form className="grid gap-6 lg:grid-cols-2" onSubmit={handleSubmit}>
        <div className="space-y-5 rounded-[28px] border border-white/10 bg-slate-950/60 p-6">
          <label className="block space-y-2 text-sm text-slate-200/90">
            <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
              {t.settings.modelLabel}
            </span>
            <Select
              value={selectedModel}
              onChange={(next) => setSelectedModel(next as ModelKey)}
              options={modelOptions}
              triggerClassName="bg-slate-900/70"
            />
          </label>

          <label
            className={`block space-y-2 text-sm text-slate-200/90 ${
              showOllamaFields ? 'opacity-60' : ''
            }`}
          >
            <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
              {t.settings.apiLabel}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={t.settings.apiPlaceholder}
              disabled={showOllamaFields}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-200/90">
            <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
              {t.settings.chunksLabel}
            </span>
            <input
              type="number"
              min={200}
              max={2000}
              step={50}
              value={chunkSize}
              onChange={(event) => setChunkSize(Number(event.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
            />
            <span className="block text-xs text-slate-300/75">{t.settings.chunksHelper}</span>
          </label>

          {showOllamaFields && (
            <div className="space-y-4 rounded-2xl border border-dashed border-violet-400/40 bg-violet-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/80">
                {t.settings.ollamaConfig.title}
              </p>

              <label className="block space-y-2 text-sm text-slate-200/90">
                <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
                  {t.settings.ollamaConfig.hostLabel}
                </span>
                <input
                  type="text"
                  value={ollamaHost}
                  onChange={(event) => setOllamaHost(event.target.value)}
                  placeholder={t.settings.ollamaConfig.hostPlaceholder}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-200/90">
                <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
                  {t.settings.ollamaConfig.portLabel}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={ollamaPort}
                  onChange={(event) => setOllamaPort(event.target.value)}
                  placeholder={t.settings.ollamaConfig.portPlaceholder}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-200/90">
                <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
                  {t.settings.ollamaConfig.modelLabel}
                </span>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(event) => setOllamaModel(event.target.value)}
                  placeholder={t.settings.ollamaConfig.modelPlaceholder}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
                />
                <span className="block text-xs text-slate-300/75">{t.settings.ollamaConfig.helper}</span>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-5 rounded-[28px] border border-white/10 bg-slate-950/60 p-6">
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/70 p-5 text-sm text-slate-200/80">
            <p>
              {t.settings.modelLabel}: <span className="font-semibold text-white">{t.settings.models[selectedModel]}</span>
            </p>
            <p className="mt-3 text-xs text-slate-300/70">{t.qa.note}</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              className="inline-flex w-fit items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-violet-500/40 transition hover:brightness-110"
            >
              {t.settings.save}
            </button>
            {feedback && <span className="text-xs font-medium text-emerald-200/90">{feedback}</span>}
          </div>
        </div>
      </form>
    </section>
  );
}
