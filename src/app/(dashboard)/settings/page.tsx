"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODEL_ORDER = ["llama", "qwen", "gemma", "ollama"] as const;

type ModelKey = (typeof MODEL_ORDER)[number];
type SettingsRecord = {
  modelKey: ModelKey;
  apiKey: string | null;
  chunkSize: number;
  ollamaHost: string | null;
  ollamaPort: string | null;
  ollamaModel: string | null;
};

export default function SettingsPage() {
  const { t } = useLanguage();
  const [selectedModel, setSelectedModel] = useState<ModelKey>("llama");
  const [apiKey, setApiKey] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [feedback, setFeedback] = useState<{
    message: string;
    isError?: boolean;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ollamaHost, setOllamaHost] = useState("127.0.0.1");
  const [ollamaPort, setOllamaPort] = useState("11434");
  const [ollamaModel, setOllamaModel] = useState("gpt-oss:20b");

  const modelOptions = useMemo(
    () =>
      MODEL_ORDER.map((key) => ({
        value: key,
        label: t.settings.models[key],
      })),
    [t.settings.models]
  );

  const showOllamaFields = selectedModel === "ollama";

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings/model", { method: "GET" });
        const data: { settings?: SettingsRecord | null; error?: string } =
          await response.json();

        if (!response.ok) {
          throw new Error(data.error || t.settings.loadError);
        }

        if (!isMounted) return;

        if (data.settings) {
          setSelectedModel(data.settings.modelKey);
          if (typeof data.settings.chunkSize === "number") {
            setChunkSize(data.settings.chunkSize);
          }
          setApiKey(data.settings.apiKey ?? "");
          setOllamaHost(data.settings.ollamaHost ?? "127.0.0.1");
          setOllamaPort(data.settings.ollamaPort ?? "11434");
          setOllamaModel(data.settings.ollamaModel ?? "gpt-oss:20b");
        }
        setLoadError(null);
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error ? error.message : t.settings.loadError;
        setLoadError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [t.settings.loadError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings/model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelKey: selectedModel,
          apiKey,
          chunkSize,
          ollamaHost,
          ollamaPort,
          ollamaModel,
        }),
      });

      const data: { settings?: SettingsRecord | null; error?: string } =
        await response.json();

      if (!response.ok) {
        throw new Error(data.error || t.settings.saveError);
      }

      if (data.settings) {
        setSelectedModel(data.settings.modelKey);
        if (typeof data.settings.chunkSize === "number") {
          setChunkSize(data.settings.chunkSize);
        }
        setApiKey(data.settings.apiKey ?? "");
        setOllamaHost(data.settings.ollamaHost ?? "127.0.0.1");
        setOllamaPort(data.settings.ollamaPort ?? "11434");
        setOllamaModel(data.settings.ollamaModel ?? "gpt-oss:20b");
      }

      setFeedback({ message: t.settings.saved, isError: false });
      setTimeout(() => setFeedback(null), 2600);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.settings.saveError;
      setFeedback({ message, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-7 rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-violet-900/20 backdrop-blur">
      <header className="space-y-3">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">
          {t.settings.title}
        </h2>
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
              onValueChange={(next) => setSelectedModel(next as ModelKey)}
              disabled={isLoading || isSaving}
            >
              <SelectTrigger
                aria-label={t.settings.modelLabel}
                className="h-auto min-h-[44px] w-full rounded-lg border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium leading-5 text-white shadow-inner shadow-violet-500/20 data-[placeholder]:text-white/60"
              >
                <SelectValue placeholder={t.settings.modelLabel} />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-950/95 text-white">
                {modelOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-white/90"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label
            className={`block space-y-2 text-sm text-slate-200/90 ${
              showOllamaFields ? "opacity-60" : ""
            }`}
          >
            <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
              {t.settings.apiLabel}
            </span>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={t.settings.apiPlaceholder}
              disabled={showOllamaFields || isSaving}
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-200/90">
            <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
              {t.settings.chunksLabel}
            </span>
            <Input
              type="number"
              min={200}
              max={2000}
              step={50}
              value={chunkSize}
              onChange={(event) => setChunkSize(Number(event.target.value))}
              disabled={isSaving}
              className="appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="block text-xs text-slate-300/75">
              {t.settings.chunksHelper}
            </span>
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
                <Input
                  type="text"
                  value={ollamaHost}
                  onChange={(event) => setOllamaHost(event.target.value)}
                  placeholder={t.settings.ollamaConfig.hostPlaceholder}
                  disabled={isSaving}
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-200/90">
                <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
                  {t.settings.ollamaConfig.portLabel}
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={ollamaPort}
                  onChange={(event) => setOllamaPort(event.target.value)}
                  placeholder={t.settings.ollamaConfig.portPlaceholder}
                  disabled={isSaving}
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-200/90">
                <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
                  {t.settings.ollamaConfig.modelLabel}
                </span>
                <Input
                  type="text"
                  value={ollamaModel}
                  onChange={(event) => setOllamaModel(event.target.value)}
                  placeholder={t.settings.ollamaConfig.modelPlaceholder}
                  disabled={isSaving}
                />
                <span className="block text-xs text-slate-300/75">
                  {t.settings.ollamaConfig.helper}
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-5 rounded-[28px] border border-white/10 bg-slate-950/60 p-6">
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/70 p-5 text-sm text-slate-200/80">
            <p>
              {t.settings.modelLabel}:{" "}
              <span className="font-semibold text-white">
                {t.settings.models[selectedModel]}
              </span>
            </p>
            <p className="mt-3 text-xs text-slate-300/70">{t.qa.note}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={isSaving || isLoading}
              variant="cta"
              size="pill"
              className="w-fit font-semibold"
            >
              {isSaving ? t.settings.saving : t.settings.save}
            </Button>
            {feedback && (
              <span
                className={`text-xs font-medium ${
                  feedback.isError ? "text-rose-200/90" : "text-emerald-200/90"
                }`}
              >
                {feedback.message}
              </span>
            )}
            {loadError && (
              <span className="text-xs font-medium text-rose-200/90">
                {loadError}
              </span>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
