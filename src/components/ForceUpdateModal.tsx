// components/ForceUpdateModal.tsx — Gerbang "Pembaruan Wajib" (Forced Update)
// Modal blocking (non-dismissible) yang mengharuskan pengguna menginstal versi
// rilis terbaru. Tidak dapat ditutup; aplikasi hanya dilanjutkan setelah pembaruan
// diterapkan & dijalankan ulang. Mengikuti standar UI/UX institusional (WCAG AAA,
// dark/light mode) — bernuansa amber sebagai penanda aksi WAJIB.

import { useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  AlertTriangle,
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  ArrowRight,
} from "lucide-react";

type ForceState = "available" | "downloading" | "ready_to_restart" | "error";

const normalizeVer = (v: string) => (v ? (v.startsWith("v") ? v : `v${v}`) : "—");
const formatSize = (bytes: number) =>
  bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "0 MB";

export function ForceUpdateModal({ update }: { update: Update }) {
  const [state, setState] = useState<ForceState>("available");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const currentVersion = normalizeVer(update.currentVersion || "");
  const targetVersion = normalizeVer(update.version);

  // Unduh & pasang pembaruan menggunakan objek Update yang telah diverifikasi.
  const handleStartUpdate = async () => {
    setState("downloading");
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(0);
    setErrorMessage(null);
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (!mountedRef.current) return;
        switch (event.event) {
          case "Started":
            total = event.data.contentLength || 0;
            setTotalBytes(total);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setDownloadedBytes(downloaded);
            if (total > 0) {
              setDownloadProgress(Math.min(100, Math.round((downloaded / total) * 100)));
            }
            break;
          case "Finished":
            setDownloadProgress(100);
            break;
        }
      });
      if (mountedRef.current) setState("ready_to_restart");
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = typeof err === "string" ? err : "Gagal mengunduh atau memasang pembaruan.";
      setErrorMessage(
        /network|fetch/i.test(msg)
          ? "Tidak dapat terhubung ke server pembaruan. Periksa koneksi internet lalu coba lagi."
          : msg,
      );
      setState("error");
    }
  };

  // Pasang ulang aplikasi ke versi terbaru yang barusan diunduh.
  const handleRelaunch = async () => {
    try {
      await relaunch();
    } catch {
      alert("Pembaruan terpasang. Silakan tutup dan buka ulang aplikasi untuk melanjutkan.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-amber-300/70 dark:border-amber-700/50 overflow-hidden flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-200/70 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/30">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pembaruan Wajib</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-700/60">
                WAJIB
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Pemerintah Kota Magelang — BPKAD
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* STATE: UPDATE AVAILABLE (default) */}
          {state === "available" && (
            <>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-slate-900 border border-amber-200/70 dark:border-amber-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Versi Terbaru Diperlukan
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 font-mono text-xs">
                      <span className="text-slate-500 dark:text-slate-400 line-through">{currentVersion}</span>
                      <ArrowRight className="h-3 w-3 text-amber-500" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{targetVersion}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Aplikasi ini <span className="font-semibold">harus diperbarui</span> ke versi{" "}
                <span className="font-bold text-slate-800 dark:text-slate-100">{targetVersion}</span> untuk dapat
                digunakan. Versi yang sedang Anda gunakan tidak lagi didukung.
              </p>

              {/* Catatan Rilis */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-line leading-relaxed font-sans">
                {update.body || "Pembaruan stabilitas dan peningkatan performa sistem."}
              </div>
            </>
          )}

          {/* STATE: DOWNLOADING */}
          {state === "downloading" && (
            <div className="space-y-4 py-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <DownloadCloud className="h-4 w-4 text-amber-500 animate-bounce" />
                  Mengunduh Pembaruan ({targetVersion})...
                </div>
                <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{downloadProgress}%</div>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Terunduh: {formatSize(downloadedBytes)}</span>
                {totalBytes > 0 && <span>Total: {formatSize(totalBytes)}</span>}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic text-center">
                Mohon jangan menutup aplikasi selama proses unduh berlangsung.
              </p>
            </div>
          )}

          {/* STATE: READY TO RESTART */}
          {state === "ready_to_restart" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pembaruan Terpasang</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Jalankan ulang aplikasi sekarang untuk memulai versi{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{targetVersion}</span>.
                </p>
              </div>
            </div>
          )}

          {/* STATE: ERROR */}
          {state === "error" && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Gagal Melakukan Pembaruan
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                {errorMessage || "Terjadi kesalahan pada layanan pembaruan."}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions — tanpa tombol tutup: pengguna WAJIB memperbarui */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-amber-200/70 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20">
          {state === "error" && (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Coba Ulangi
            </button>
          )}

          {state === "available" && (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <DownloadCloud className="h-4 w-4" />
              Perbarui Sekarang
            </button>
          )}

          {state === "ready_to_restart" && (
            <button
              type="button"
              onClick={handleRelaunch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Mulai Ulang Aplikasi
            </button>
          )}

          {state === "downloading" && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Memproses…</span>
          )}
        </div>
      </div>
    </div>
  );
}
