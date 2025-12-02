"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ALLOWED_FILE_ACCEPT,
  ALLOWED_FILE_EXTENSION_SET,
} from "@/lib/library/file-types";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import clsx from "clsx";

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
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const statusStyles: Record<Status, string> = useMemo(
    () => ({
      uploaded: isLight
        ? "border border-slate-200 bg-slate-50 text-slate-700"
        : "border border-slate-500/40 bg-slate-700/40 text-slate-200",
      indexing: isLight
        ? "border border-amber-200 bg-amber-50 text-amber-800"
        : "border border-amber-300/40 bg-amber-500/15 text-amber-100",
      indexed: isLight
        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border border-emerald-300/40 bg-emerald-500/15 text-emerald-100",
    }),
    [isLight]
  );

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
    } finally {
      setPendingDelete(null);
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
    <section
      className="flex flex-col space-y-6 overflow-hidden rounded-[32px] border border-border bg-card/90 p-8 text-foreground shadow-xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-white dark:shadow-violet-900/20"
      style={{ height: "min(794px, calc(100vh - 220px))" }}
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {t.library.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelection}
            disabled={isUploading}
            accept={ALLOWED_FILE_ACCEPT}
            className="sr-only"
            aria-busy={isUploading}
          />
          <Button
            type="button"
            variant="cta"
            size="pill-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-5 py-2 text-sm font-semibold"
          >
            {isUploading ? t.library.uploading : t.library.uploadCta}
          </Button>
        </div>
      </header>

      <div className="scrollbar-dark flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="rounded-[28px] border border-dashed border-border bg-muted/40 p-6 text-sm text-foreground dark:border-white/15 dark:bg-slate-950/60">
          <p className="font-medium text-foreground">{t.library.dropLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t.library.uploadHint}
          </p>
        </div>

        {message && (
          <div
            className={`rounded-[28px] px-5 py-3 text-sm ${
              message.type === "error"
                ? isLight
                  ? "border border-red-200 bg-red-50 text-red-800"
                  : "border border-red-400/40 bg-red-500/10 text-red-100"
                : isLight
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="overflow-hidden rounded-[28px] border border-border dark:border-white/10">
          <div className="grid grid-cols-[2fr_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-4 border-b border-border bg-muted/70 px-7 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground dark:border-white/10 dark:bg-slate-950/70">
            <span>{t.library.tableHeaders.name}</span>
            <span>{t.library.tableHeaders.size}</span>
            <span>{t.library.tableHeaders.status}</span>
            <span>{t.library.tableHeaders.updated}</span>
          </div>
          <div className="divide-y divide-border bg-card dark:divide-white/5 dark:bg-slate-950/60">
            {documents.length === 0 ? (
              <div className="px-7 py-10 text-center text-sm text-muted-foreground">
                {isLoading ? t.library.loading : t.library.emptyState}
              </div>
            ) : (
              documents.map((doc) => {
                const stageLabel =
                  doc.indexingStage &&
                  t.library.indexingStages[doc.indexingStage]
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
                    className="grid grid-cols-[2fr_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center gap-4 px-7 py-5 text-sm text-foreground dark:text-white/90"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-foreground dark:text-white">
                        {doc.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.library.chunkingNote}
                      </p>
                    </div>
                    <span className="text-sm text-foreground/80 dark:text-slate-200/80">
                      {doc.size}
                    </span>
                    <span
                      className={`inline-flex min-w-[92px] items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                        statusStyles[doc.status]
                      }`}
                    >
                      {statusLabel}
                    </span>
                    <span className="text-xs text-foreground/70 dark:text-slate-200/80">
                      {dateFormatter.format(doc.updatedAt)}
                    </span>
                    <div className="flex gap-1.5 text-xs text-foreground/80 dark:text-slate-200/80">
                      <Button
                        type="button"
                        onClick={() => handleIndex(doc.id)}
                        disabled={
                          doc.status === "indexed" || doc.status === "indexing"
                        }
                        variant="cta"
                        size="pill-sm"
                        //className="px-3 py-1 text-[11px] font-semibold",
                        className={clsx(
                          "px-3 py-1 text-[11px] font-semibold",
                          doc.status === "indexed"
                            ? "disabled:pointer-events-auto disabled:cursor-not-allowed"
                            : "cursor-pointer"
                        )}
                      >
                        {actionLabel}
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          setPendingDelete({ id: doc.id, name: doc.name })
                        }
                        size="sm"
                        variant="destructive"
                        className="px-3 py-1 text-[11px] font-semibold hover:!bg-destructive/100 cursor-pointer"
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
      </div>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.library.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.library.deleteDialog.description}
              {pendingDelete?.name ? ` (${pendingDelete.name})` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t.library.deleteDialog.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  void handleDelete(pendingDelete.id);
                }
              }}
            >
              {t.library.deleteDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
