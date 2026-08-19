// components/ConfirmDeleteDialog.tsx — Modal Konfirmasi Hapus Data / Hapus Bukti Scan.

import { useEffect } from "react";
import type { KoreksiRow } from "../lib/types";
import { AlertTriangle, Trash2, X } from "lucide-react";

export function ConfirmDeleteDialog({
  open,
  target,
  mode,
  loading = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  target: KoreksiRow | null;
  mode: "record" | "bukti";
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // Shortcut Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !target) return null;

  const isRecord = mode === "record";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header Icon */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isRecord ? "Konfirmasi Hapus Data" : "Hapus File Bukti Scan"}
              </h3>
              <p className="text-xs text-slate-500">
                {isRecord
                  ? "Tindakan ini akan menghapus seluruh data berkas"
                  : "Status berkas akan kembali menjadi Menunggu Bukti"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Detail Record yang akan dihapus */}
        <div className="my-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">No. BA Koreksi:</span>
            <span className="font-mono font-bold text-slate-900">{target.no_ba}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">No. Surat TU:</span>
            <span className="font-mono text-slate-700">{target.no_tu}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">OPD Pengusul:</span>
            <span className="font-semibold text-slate-800 text-right max-w-[220px] truncate">
              {target.nama_opd}
            </span>
          </div>
          {!isRecord && target.file_name && (
            <div className="flex justify-between border-t border-slate-200 pt-1.5">
              <span className="text-slate-500">Nama File:</span>
              <span className="font-mono text-indigo-700 text-right max-w-[200px] truncate">
                {target.file_name}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          {isRecord
            ? "Apakah Anda yakin ingin menghapus data koreksi ini secara permanen? Jika terdapat file bukti scan, file tersebut juga akan dihapus dari penyimpanan."
            : "Apakah Anda yakin ingin menghapus file bukti scan ini? Berkas bukti fisik akan dihapus dari penyimpanan dan status tanda terima dikembalikan ke MENUNGGU BUKTI."}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {loading ? "Menghapus…" : isRecord ? "Hapus Permanen" : "Hapus Bukti"}
          </button>
        </div>
      </div>
    </div>
  );
}
