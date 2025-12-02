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
    <section
      className="flex flex-col space-y-7 overflow-hidden rounded-[32px] border border-border bg-card/90 p-8 text-foreground shadow-xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-white dark:shadow-violet-900/20"
      style={{ height: "min(794px, calc(100vh - 220px))" }}
    >
      <header className="space-y-3">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {t.settings.title}
        </h2>
      </header>

      <form
        className="scrollbar-dark grid flex-1 min-h-0 gap-6 overflow-y-auto pr-1 lg:grid-cols-2 lg:overflow-visible lg:pr-0"
        onSubmit={handleSubmit}
      >
        <div className="space-y-5 rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
          <label className="block space-y-2 text-sm text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {t.settings.modelLabel}
            </span>
            <Select
              value={selectedModel}
              onValueChange={(next) => setSelectedModel(next as ModelKey)}
              disabled={isLoading || isSaving}
            >
              <SelectTrigger
                aria-label={t.settings.modelLabel}
                className="h-auto min-h-[44px] w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium leading-5 text-foreground shadow-inner shadow-slate-900/5 data-[placeholder]:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:shadow-violet-500/20"
              >
                <SelectValue placeholder={t.settings.modelLabel} />
              </SelectTrigger>
              <SelectContent className="border border-border bg-card text-foreground shadow-lg dark:border-white/10 dark:bg-slate-950/95 dark:text-white">
                {modelOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-foreground dark:text-white/90"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label
            className={`block space-y-2 text-sm text-muted-foreground ${
              showOllamaFields ? "opacity-60" : ""
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
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

          <label className="block space-y-2 text-sm text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
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
            <span className="block text-xs text-muted-foreground">
              {t.settings.chunksHelper}
            </span>
          </label>

          {showOllamaFields && (
            <div className="space-y-4 rounded-2xl border border-dashed border-violet-400/40 bg-violet-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-200/80">
                {t.settings.ollamaConfig.title}
              </p>

              <label className="block space-y-2 text-sm text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
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

              <label className="block space-y-2 text-sm text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
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

              <label className="block space-y-2 text-sm text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  {t.settings.ollamaConfig.modelLabel}
                </span>
                <Input
                  type="text"
                  value={ollamaModel}
                  onChange={(event) => setOllamaModel(event.target.value)}
                  placeholder={t.settings.ollamaConfig.modelPlaceholder}
                  disabled={isSaving}
                />
                <span className="block text-xs text-muted-foreground">
                  {t.settings.ollamaConfig.helper}
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-5 rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm text-foreground dark:border-white/15 dark:bg-slate-900/70">
            <p>
              {t.settings.modelLabel}:{" "}
              <span className="font-semibold text-foreground dark:text-white">
                {t.settings.models[selectedModel]}
              </span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{t.qa.note}</p>
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
                  feedback.isError
                    ? "text-rose-600 dark:text-rose-200/90"
                    : "text-emerald-700 dark:text-emerald-200/90"
                }`}
              >
                {feedback.message}
              </span>
            )}
            {loadError && (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-200/90">
                {loadError}
              </span>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
