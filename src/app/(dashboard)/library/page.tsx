"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ALLOWED_FILE_ACCEPT,
  ALLOWED_FILE_EXTENSION_SET,
} from "@/lib/library/file-types";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";

type Status = "uploaded" | "indexing" | "indexed";
type IndexingStage = "extracting" | "chunking" | "embedding" | "saving";

type DocumentRecord = {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  status: Status;
  indexingStage: IndexingStage | null;
  indexingProgress: number;
  updatedAt: number;
  chunkCount?: number;
  embeddingModel?: string | null;
};

type ToastMessage = {
  type: "success" | "error";
  text: string;
};

type ApiFile = {
  id: string;
  name: string;
  size: number;
  status: string;
  indexingStage?: string | null;
  indexingProgress?: number | null;
  uploadedAt?: string;
  updatedAt?: string;
  chunkCount?: number;
  lastIndexedAt?: string | null;
  embeddingModel?: string | null;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[exponent]}`;
};

const KNOWN_STATUSES: Status[] = ["uploaded", "indexing", "indexed"];
const KNOWN_STAGES: IndexingStage[] = [
  "extracting",
  "chunking",
  "embedding",
  "saving",
];

const toStatus = (status: string): Status =>
  KNOWN_STATUSES.includes(status as Status) ? (status as Status) : "uploaded";

const toIndexingStage = (
  stage: string | null | undefined
): IndexingStage | null =>
  stage && KNOWN_STAGES.includes(stage as IndexingStage)
    ? (stage as IndexingStage)
    : null;

const clampProgress = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  return Math.max(0, Math.min(100, rounded));
};

const toDocumentRecord = (file: ApiFile): DocumentRecord => {
  const uploadedAt = file.updatedAt ?? file.uploadedAt ?? "";
  const timestamp = Number.isNaN(Date.parse(uploadedAt))
    ? Date.now()
    : new Date(uploadedAt).getTime();

  return {
    id: file.id,
    name: file.name,
    size: formatBytes(file.size),
    sizeBytes: file.size,
    status: toStatus(file.status ?? "uploaded"),
    indexingStage: toIndexingStage(file.indexingStage ?? null),
    indexingProgress: clampProgress(file.indexingProgress ?? 0),
    updatedAt: timestamp,
    chunkCount: file.chunkCount,
    embeddingModel: file.embeddingModel ?? null,
  };
};

const isSupportedFile = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extension.length > 0 && ALLOWED_FILE_EXTENSION_SET.has(extension);
};

export default function LibraryPage() {
  const { t, language } = useLanguage();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const locale = language === "en" ? "en-US" : "zh-CN";
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale]
  );

  const statusStyles: Record<Status, string> = {
    uploaded: "border border-slate-500/40 bg-slate-700/40 text-slate-200",
    indexing: "border border-amber-300/40 bg-amber-500/15 text-amber-100",
    indexed: "border border-emerald-300/40 bg-emerald-500/15 text-emerald-100",
  };

  const hasIndexingDocuments = useMemo(
    () => documents.some((doc) => doc.status === "indexing"),
    [documents]
  );

  useEffect(() => {
    let cancelled = false;

    const loadDocuments = async () => {
      try {
        const response = await fetch("/api/library");
        if (!response.ok) {
          throw new Error("Failed to load documents");
        }

        const payload: { files?: ApiFile[] } = await response.json();
        if (cancelled) {
          return;
        }

        const nextDocuments = (payload.files ?? []).map(toDocumentRecord);
        setDocuments(nextDocuments);
      } catch (error) {
        console.error("Failed to load library documents", error);
        if (!cancelled) {
          setMessage({ type: "error", text: t.library.loadError });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [t.library.loadError]);

  useEffect(() => {
    if (!hasIndexingDocuments) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const pollDocuments = async () => {
      try {
        const response = await fetch("/api/library");
        if (!response.ok) {
          throw new Error("Failed to load documents");
        }

        const payload: { files?: ApiFile[] } = await response.json();
        if (cancelled) {
          return;
        }

        const nextDocuments = (payload.files ?? []).map(toDocumentRecord);
        setDocuments((prev) => {
          const previousById = new Map(prev.map((doc) => [doc.id, doc]));
          const completed = nextDocuments.some((doc) => {
            if (doc.status !== "indexed") {
              return false;
            }
            const previous = previousById.get(doc.id);
            return previous?.status === "indexing";
          });

          if (completed) {
            setMessage({ type: "success", text: t.library.indexSuccess });
          }

          return nextDocuments;
        });
      } catch (error) {
        console.error("Failed to refresh indexing progress", error);
        if (!cancelled) {
          setMessage({ type: "error", text: t.library.operationError });
        }
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(pollDocuments, 4000);
        }
      }
    };

    pollDocuments();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasIndexingDocuments, t.library.operationError, t.library.indexSuccess]);

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    const invalidFiles = Array.from(files).filter(
      (file) => !isSupportedFile(file.name)
    );

    if (invalidFiles.length > 0) {
      setMessage({ type: "error", text: t.library.invalidType });
      input.value = "";
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    setIsUploading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage =
          (errorPayload && typeof errorPayload.error === "string"
            ? errorPayload.error
            : undefined) ?? t.library.uploadError;
        throw new Error(errorMessage);
      }

      const payload: { files?: ApiFile[] } = await response.json();

      const newDocs: DocumentRecord[] =
        payload.files?.map((file) => toDocumentRecord(file)) ?? [];

      if (newDocs.length === 0) {
        throw new Error(t.library.uploadError);
      }

      setDocuments((prev) => [...newDocs, ...prev]);
      setMessage({ type: "success", text: t.library.successToast });
    } catch (error) {
      console.error("Failed to upload files", error);
      let fallback = t.library.uploadError;
      if (error instanceof Error && error.message) {
        fallback = /unsupported file type/i.test(error.message)
          ? t.library.invalidType
          : error.message;
      }
      setMessage({ type: "error", text: fallback });
    } finally {
      input.value = "";
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/library/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      setMessage({ type: "success", text: t.toasts.deleted });
    } catch (error) {
      console.error("Failed to delete document", error);
      setMessage({ type: "error", text: t.library.operationError });
    }
  };

  const handleIndex = async (id: string) => {
    const target = documents.find((doc) => doc.id === id);
    if (!target || target.status === "indexing") {
      return;
    }

    const previousStatus = target.status;
    const previousStage = target.indexingStage;
    const previousProgress = target.indexingProgress;

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              status: "indexing",
              indexingStage: "extracting",
              indexingProgress: 0,
            }
          : doc
      )
    );
    setMessage({ type: "success", text: t.toasts.indexing });

    try {
      const response = await fetch(`/api/library/${id}/index`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errorMessage =
          payload && typeof payload.error === "string"
            ? payload.error
            : t.library.operationError;
        throw new Error(errorMessage);
      }

      const payload: { file?: ApiFile } = await response.json();
      if (!payload.file) {
        throw new Error("Missing indexing response");
      }

      const indexedRecord = toDocumentRecord(payload.file);

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? indexedRecord : doc))
      );
    } catch (error) {
      console.error("Failed to index document", error);
      const fallback =
        error instanceof Error && error.message
          ? error.message
          : t.library.operationError;
      setMessage({ type: "error", text: fallback });
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? {
                ...doc,
                status: previousStatus,
                indexingStage: previousStage,
                indexingProgress: previousProgress,
              }
            : doc
        )
      );
    }
  };

  return (
    <section className="space-y-7 rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-violet-900/20 backdrop-blur">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            {t.library.title}
          </h2>
          <p className="mt-1 text-base text-slate-200/80">
            {t.library.subtitle}
          </p>
        </div>
        <label
          className={`flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-500/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-violet-200/70 hover:bg-violet-500/30 ${
            isUploading ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          }`}
          aria-busy={isUploading}
        >
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelection}
            disabled={isUploading}
            accept={ALLOWED_FILE_ACCEPT}
          />
          {isUploading ? t.library.uploading : t.library.uploadCta}
        </label>
      </header>

      <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-950/60 p-6 text-sm text-slate-200/80">
        <p className="font-medium text-white/90">{t.library.dropLabel}</p>
        <p className="mt-2 text-xs text-slate-300/70">{t.library.uploadHint}</p>
      </div>

      {message && (
        <div
          className={`rounded-[28px] px-5 py-3 text-sm ${
            message.type === "error"
              ? "border border-red-400/40 bg-red-500/10 text-red-100"
              : "border border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-white/10">
        <div className="grid grid-cols-[2fr_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-4 border-b border-white/10 bg-slate-950/70 px-7 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300/80">
          <span>{t.library.tableHeaders.name}</span>
          <span>{t.library.tableHeaders.size}</span>
          <span>{t.library.tableHeaders.status}</span>
          <span>{t.library.tableHeaders.updated}</span>
        </div>
        <div className="divide-y divide-white/5 bg-slate-950/60">
          {documents.length === 0 ? (
            <div className="px-7 py-10 text-center text-sm text-slate-300/70">
              {isLoading ? t.library.loading : t.library.emptyState}
            </div>
          ) : (
            documents.map((doc) => {
              const stageLabel =
                doc.indexingStage && t.library.indexingStages[doc.indexingStage]
                  ? t.library.indexingStages[doc.indexingStage]
                  : null;
              const isIndexing = doc.status === "indexing";
              const progressLabel = isIndexing
                ? ` (${doc.indexingProgress}%)`
                : "";
              const statusLabel = isIndexing
                ? `${t.library.status.indexing}${
                    stageLabel ? ` · ${stageLabel}` : ""
                  }${progressLabel}`
                : t.library.status[doc.status];
              const actionLabel = isIndexing
                ? `${stageLabel ?? t.library.status.indexing}${progressLabel}`
                : t.library.indexAction;

              return (
                <div
                  key={doc.id}
                  className="grid grid-cols-[2fr_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center gap-4 px-7 py-5 text-sm text-white/90"
                >
                  <div className="min-w-0 space-y-1">
                  <p className="truncate text-base font-semibold text-white">
                    {doc.name}
                  </p>
                  <p className="text-xs text-slate-300/70">
                    {t.library.chunkingNote}
                  </p>
                </div>
                <span className="text-sm text-slate-200/80">{doc.size}</span>
                <span
                  className={`inline-flex min-w-[92px] items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                    statusStyles[doc.status]
                  }`}
                >
                  {statusLabel}
                </span>
                <span className="text-xs text-slate-200/80">
                  {dateFormatter.format(doc.updatedAt)}
                </span>
                <div className="flex gap-1.5 text-xs text-slate-200/80">
                  <Button
                    type="button"
                    onClick={() => handleIndex(doc.id)}
                    disabled={
                      doc.status === "indexed" || doc.status === "indexing"
                    }
                    size="sm"
                    className="h-auto rounded-lg border border-violet-300/40 bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-100 transition hover:border-violet-200/60 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLabel}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    variant="outline"
                    size="sm"
                    className="h-auto rounded-lg border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-100"
                  >
                    {t.library.deleteAction}
                  </Button>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
