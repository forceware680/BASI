// components/UploadSourceDialog.tsx — Modal Pilihan Sumber Unggah Bukti (File Explorer vs Mesin Scanner Langsung).

import { useEffect, useState } from "react";
import type { KoreksiRow } from "../lib/types";
import {
  FolderOpen,
  Printer,
  X,
  Loader2,
  FileCheck2,
  AlertCircle,
} from "lucide-react";

export function UploadSourceDialog({
  open,
  row,
  onClose,
  onSelectExplorer,
  onSelectScanner,
  loading = false,
  loadingMessage = "",
}: {
  open: boolean;
  row: KoreksiRow | null;
  onClose: () => void;
  onSelectExplorer: (row: KoreksiRow) => void;
  onSelectScanner: (row: KoreksiRow) => void;
  loading?: boolean;
  loadingMessage?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  // Shortcut Escape untuk tutup
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, loading, onClose]);

  if (!open || !row) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 shadow-sm">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Unggah Bukti Scan BA Koreksi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih sumber dokumen bukti tanda terima fisik
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Informasi Berkas Target */}
        <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400">No. BA Koreksi:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{row.no_ba}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400">OPD Pengusul:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px]">{row.nama_opd}</span>
          </div>
        </div>

        {/* Notifikasi Loading / Error */}
        {loading && (
          <div className="mb-5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/50 p-4 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
            <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              {loadingMessage || "Sedang memproses..."}
            </p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
              Silakan tunggu antarmuka scanner atau dialog berkas selesai
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Pilihan Metode */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Opsi 1: File Explorer */}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setError(null);
              onSelectExplorer(row);
            }}
            className="group flex flex-col text-left rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 transition-all hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 group-hover:scale-105 transition-transform mb-3">
              <FolderOpen className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Pilih dari File Explorer
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Pilih dokumen digital yang sudah tersimpan di laptop/PC (format PDF, JPG, PNG).
            </span>
          </button>

          {/* Opsi 2: Scanner Langsung */}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setError(null);
              onSelectScanner(row);
            }}
            className="group flex flex-col text-left rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 transition-all hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 group-hover:scale-105 transition-transform mb-3">
              <Printer className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Pindai dari Scanner
              </span>
              <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                WIA
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Buka dialog pemindaian Windows dan pindai lembar fisik langsung dari mesin scanner.
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs text-slate-400">
          <span>Tekan <kbd className="font-mono text-[11px] rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700">Esc</kbd> untuk batal</span>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
