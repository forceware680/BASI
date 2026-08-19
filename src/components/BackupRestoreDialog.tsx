// components/BackupRestoreDialog.tsx — Modal Backup & Restore Penuh Data + File Bukti dengan Dark Mode.

import { useEffect, useState } from "react";
import { createBackup, restoreBackup } from "../lib/api";
import {
  Archive,
  DownloadCloud,
  UploadCloud,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  HardDrive,
} from "lucide-react";

export function BackupRestoreDialog({
  open,
  onClose,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"backup" | "restore">("backup");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    setMessage(null);
    setLoading(false);
  }, [open, activeTab]);

  // Shortcut Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleCreateBackup = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const savedPath = await createBackup();
      if (savedPath) {
        setMessage({
          text: `Cadangan berhasil dibuat dan disimpan di:\n${savedPath}`,
          ok: true,
        });
      }
    } catch (e) {
      setMessage({ text: `Gagal membuat cadangan: ${e}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (
      !window.confirm(
        "PENTING: Memulihkan cadangan akan memperbarui data database dan file bukti scan. Pastikan Anda memilih file backup yang benar. Lanjutkan?"
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const summary = await restoreBackup();
      if (summary) {
        setMessage({
          text: `Pemulihan Sukses: ${summary}`,
          ok: true,
        });
        onRestored();
      }
    } catch (e) {
      setMessage({ text: `Gagal memulihkan cadangan: ${e}`, ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-sm">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cadangan & Pemulihan Sistem
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Backup database PostgreSQL & seluruh file fisik scan (.zip)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mt-4 flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition-all ${
              activeTab === "backup"
                ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold"
                : "hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <DownloadCloud className="h-4 w-4" />
            Buat Cadangan (Backup)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("restore")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition-all ${
              activeTab === "restore"
                ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold"
                : "hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Pulihkan Data (Restore)
          </button>
        </div>

        {/* Feedback Pesan */}
        {message && (
          <div
            className={`mt-4 rounded-xl p-3.5 text-xs font-medium border flex items-start gap-2.5 whitespace-pre-wrap leading-relaxed ${
              message.ok
                ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                : "border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300"
            }`}
          >
            {message.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            )}
            <div>{message.text}</div>
          </div>
        )}

        {/* Konten Tab Backup */}
        {activeTab === "backup" && (
          <div className="space-y-4 py-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <HardDrive className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Cakupan Berkas Cadangan:
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Seluruh data master OPD & catatan Berita Acara Koreksi.</li>
                <li>Seluruh berkas fisik PDF/JPG/PNG bukti scan tanda terima.</li>
                <li>File dibundel menjadi 1 arsip berekstensi <b>.zip</b> yang aman dan mudah dipindahkan.</li>
              </ul>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleCreateBackup}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sedang Mengompresi & Menyimpan Cadangan…
                </>
              ) : (
                <>
                  <DownloadCloud className="h-4 w-4" />
                  Simpan Cadangan (.zip) ke Komputer
                </>
              )}
            </button>
          </div>
        )}

        {/* Konten Tab Restore */}
        {activeTab === "restore" && (
          <div className="space-y-4 py-5">
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Perhatian Sebelum Memulihkan Data:
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                Pilihlah file arsip cadangan (<b>.zip</b>) yang sebelumnya dibuat dari aplikasi ini. Data yang ada akan disinkronkan dan berkas bukti fisik akan diekstrak kembali ke penyimpanan aplikasi.
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleRestoreBackup}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-xs font-semibold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sedang Mengekstrak & Memulihkan Database…
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  Pilih File Cadangan (.zip) & Pulihkan
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
