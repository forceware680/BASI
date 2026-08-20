// components/BuktiViewerDialog.tsx — viewer file bukti scan (REQ-05, Task 4) dengan Dark Mode.

import { useEffect, useRef, useState } from "react";
import type { KoreksiRow } from "../lib/types";
import { getBuktiBase64, openBuktiPath } from "../lib/api";
import {
  FileText,
  ExternalLink,
  X,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

export function BuktiViewerDialog({
  row,
  onClose,
  onDeleteBukti,
}: {
  row: KoreksiRow | null;
  onClose: () => void;
  onDeleteBukti?: (row: KoreksiRow) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfFallback, setPdfFallback] = useState(false);
  const [zoom, setZoom] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!row) {
      setDataUrl(null);
      setMime(null);
      setError(null);
      setPdfFallback(false);
      setZoom(1);
      return;
    }
    let cancelled = false;
    setDataUrl(null);
    setMime(null);
    setError(null);
    setPdfFallback(false);
    setZoom(1);
    setLoading(true);

    getBuktiBase64(row.id)
      .then((res) => {
        if (cancelled) return;
        setMime(res[0]);
        setDataUrl(res[1]);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [row]);

  // Shortcut Escape untuk tutup
  useEffect(() => {
    if (!row) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [row, onClose]);

  if (!row) return null;

  const isPdf = mime === "application/pdf";
  const isImg = mime?.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-colors">
        {/* Header Dialog */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Pratinjau Bukti Tanda Terima
                </h2>
                <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  SELESAI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                BA: <span className="font-semibold text-slate-700 dark:text-indigo-300">{row.no_ba}</span>
                {row.file_name && <span className="text-slate-400 dark:text-slate-500"> — {row.file_name}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Buka OS */}
            {row.file_path && (
              <button
                type="button"
                onClick={() =>
                  openBuktiPath(row.file_path!).catch((e) =>
                    alert("Gagal membuka file di OS: " + e)
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka di OS
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Konten Area Viewer */}
        <div className="relative flex-1 overflow-auto p-6 bg-slate-100/50 dark:bg-slate-950/60 flex flex-col items-center justify-center min-h-[420px]">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm font-medium">Memuat file bukti scan…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-6 text-center max-w-md">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-bold text-red-900 dark:text-red-300">Gagal Membaca File</h3>
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* PDF Viewer */}
          {!loading && dataUrl && isPdf && !pdfFallback && (
            <div className="flex flex-col gap-3 w-full h-full">
              <iframe
                ref={iframeRef}
                src={dataUrl}
                className="h-[62vh] w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white shadow-inner"
                title="Bukti PDF"
                onError={() => setPdfFallback(true)}
              />
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Jika PDF tidak muncul di jendela ini, Anda dapat{" "}
                <button
                  type="button"
                  className="font-medium text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300"
                  onClick={() =>
                    openBuktiPath(row.file_path!).catch((e) =>
                      alert("Gagal membuka file: " + e)
                    )
                  }
                >
                  membukanya di aplikasi bawaan Windows
                </button>.
              </p>
            </div>
          )}

          {/* PDF Fallback jika embed diblokir */}
          {!loading && dataUrl && isPdf && pdfFallback && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shadow-sm">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  File Dokumen PDF Siap
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Pratinjau PDF di dalam webview dibatasi oleh keamanan sistem. Buka dengan aplikasi default untuk melihat dokumen lengkap.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openBuktiPath(row.file_path!).catch((e) =>
                    alert("Gagal membuka file: " + e)
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
              >
                <ExternalLink className="h-4 w-4" />
                Buka dengan Aplikasi Default
              </button>
            </div>
          )}

          {/* Gambar Viewer (JPG/PNG) dengan kontrol Zoom */}
          {!loading && dataUrl && isImg && (
            <div className="flex flex-col items-center gap-4 w-full">
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-3 py-1 shadow-sm backdrop-blur">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Perkecil"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="min-w-[48px] text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Perbesar"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Reset Ukuran"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="max-h-[60vh] max-w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm">
                <img
                  src={dataUrl}
                  alt="Bukti scan"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                  className="rounded-lg object-contain transition-transform duration-150"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {row.uploaded_at ? (
              <span>
                Diunggah pada:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {new Date(row.uploaded_at).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </span>
            ) : (
              <span>Status: Siap diverifikasi</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onDeleteBukti && (
              <button
                type="button"
                onClick={() => onDeleteBukti(row)}
                className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 shadow-sm hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              >
                Hapus Bukti Scan
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 dark:bg-slate-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
