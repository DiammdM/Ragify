"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";

type Status = "uploaded" | "indexing" | "indexed";

type DocumentRecord = {
  id: string;
  name: string;
  size: string;
  status: Status;
  updatedAt: number;
};

const INITIAL_DOCUMENTS: DocumentRecord[] = [
  {
    id: "doc-1",
    name: "Onboarding Guide.pdf",
    size: "2.4 MB",
    status: "indexed",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "doc-2",
    name: "Pricing FAQ.docx",
    size: "1.1 MB",
    status: "uploaded",
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
  },
];

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

export default function LibraryPage() {
  const { t, language } = useLanguage();
  const [documents, setDocuments] =
    useState<DocumentRecord[]>(INITIAL_DOCUMENTS);
  const [message, setMessage] = useState<string | null>(null);

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

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const snapshot = Date.now();
    const newDocs: DocumentRecord[] = Array.from(files).map((file, index) => ({
      id: `${file.name}-${snapshot}-${index}`,
      name: file.name,
      size: formatBytes(file.size),
      status: "uploaded",
      updatedAt: Date.now(),
    }));

    setDocuments((prev) => [...newDocs, ...prev]);
    setMessage(t.library.successToast);
    event.target.value = "";
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    setMessage(t.toasts.deleted);
  };

  const handleIndex = (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              status: "indexing",
            }
          : doc
      )
    );
    setMessage(t.toasts.indexing);

    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? {
                ...doc,
                status: "indexed",
                updatedAt: Date.now(),
              }
            : doc
        )
      );
    }, 1500);
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
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-violet-300/60 bg-violet-500/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-violet-200/70 hover:bg-violet-500/30">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelection}
          />
          {t.library.uploadCta}
        </label>
      </header>

      <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-950/60 p-6 text-sm text-slate-200/80">
        <p className="font-medium text-white/90">{t.library.dropLabel}</p>
        <p className="mt-2 text-xs text-slate-300/70">{t.library.uploadHint}</p>
      </div>

      {message && (
        <div className="rounded-[28px] border border-emerald-400/40 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-100">
          {message}
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
              {t.library.emptyState}
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
