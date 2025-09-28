"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ALLOWED_FILE_ACCEPT,
  ALLOWED_FILE_EXTENSION_SET,
} from "@/lib/library/file-types";
import { useLanguage } from "@/components/language-provider";

type Status = "uploaded" | "indexing" | "indexed";

type DocumentRecord = {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  status: Status;
  updatedAt: number;
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
  uploadedAt?: string;
  updatedAt?: string;
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

const toStatus = (status: string): Status =>
  KNOWN_STATUSES.includes(status as Status) ? (status as Status) : "uploaded";

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
    updatedAt: timestamp,
  };
};

const isSupportedFile = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extension.length > 0 && ALLOWED_FILE_EXTENSION_SET.has(extension);
};

export default function LibraryPage() {
  const { t, language } = useLanguage();
  const [documents, setDocuments] =
    useState<DocumentRecord[]>([]);
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

  const applyDocumentUpdate = (record: DocumentRecord) => {
    setDocuments((prev) => {
      const index = prev.findIndex((doc) => doc.id === record.id);
      if (index === -1) {
        return [record, ...prev];
      }

      const next = [...prev];
      next[index] = record;
      return next;
    });
  };

  const updateRemoteStatus = async (docId: string, status: Status) => {
    const response = await fetch(`/api/library/${docId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const errorMessage =
        payload && typeof payload.error === "string"
          ? payload.error
          : "Failed to update status";
      throw new Error(errorMessage);
    }

    const payload: { file?: ApiFile } = await response.json();
    if (!payload.file) {
      throw new Error("Missing file in response");
    }

    return toDocumentRecord(payload.file);
  };

  const handleIndex = async (id: string) => {
    const target = documents.find((doc) => doc.id === id);
    if (!target || target.status !== "uploaded") {
      return;
    }

    try {
      const indexingRecord = await updateRemoteStatus(id, "indexing");
      applyDocumentUpdate(indexingRecord);
      setMessage({ type: "success", text: t.toasts.indexing });

      setTimeout(() => {
        updateRemoteStatus(id, "indexed")
          .then((indexedRecord) => {
            applyDocumentUpdate(indexedRecord);
          })
          .catch((error) => {
            console.error("Failed to finalize indexing", error);
            setMessage({
              type: "error",
              text: t.library.operationError,
            });
            applyDocumentUpdate(indexingRecord);
          });
      }, 1500);
    } catch (error) {
      console.error("Failed to start indexing", error);
      setMessage({ type: "error", text: t.library.operationError });
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
            documents.map((doc) => (
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
                  {t.library.status[doc.status]}
                </span>
                <span className="text-xs text-slate-200/80">
                  {dateFormatter.format(doc.updatedAt)}
                </span>
                <div className="flex gap-1.5 text-xs text-slate-200/80">
                  <button
                    type="button"
                    onClick={() => handleIndex(doc.id)}
                    disabled={
                      doc.status === "indexed" || doc.status === "indexing"
                    }
                    className="rounded-lg border border-violet-300/40 bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-100 transition hover:border-violet-200/60 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {doc.status === "indexing"
                      ? t.library.status.indexing
                      : t.library.indexAction}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-100"
                  >
                    {t.library.deleteAction}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
