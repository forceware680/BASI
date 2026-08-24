// components/UpdateDialog.tsx — Modal Pembaruan Aplikasi Otomatis (Tauri v2 Updater)
// Mengikuti standar UI/UX GEMINI.MD & Impeccable (Operate Mode, WCAG AAA, Dark/Light Mode).

import { useEffect, useState, useRef } from "react";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  DownloadCloud,
  ArrowRight,
  ShieldCheck,
  X,
  RotateCcw,
} from "lucide-react";
import logoKotaMagelang from "../assets/logo-kota-magelang.png";

type UpdateState =
  | "checking"
  | "available"
  | "downloading"
  | "ready_to_restart"
  | "up_to_date"
  | "error";

export function UpdateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<UpdateState>("checking");
  const [updateObj, setUpdateObj] = useState<Update | null>(null);
  const [targetVersion, setTargetVersion] = useState<string>("");
  const [releaseNotes, setReleaseNotes] = useState<string>("");
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Ambil versi aplikasi yang sedang berjalan secara dinamis
  useEffect(() => {
    getVersion()
      .then((ver) => {
        if (ver && mountedRef.current) {
          setCurrentVersion(ver.startsWith("v") ? ver : `v${ver}`);
        }
      })
      .catch(() => {});
  }, []);

  const checkForUpdates = async () => {
    setState("checking");
    setErrorMessage(null);
    setDownloadProgress(0);

    try {
      const runningVer = await getVersion().catch(() => "");
      if (runningVer && mountedRef.current) {
        setCurrentVersion(runningVer.startsWith("v") ? runningVer : `v${runningVer}`);
      }

      const update = await check();
      if (!mountedRef.current) return;

      if (update && update.available) {
        setUpdateObj(update);
        setTargetVersion(update.version.startsWith("v") ? update.version : `v${update.version}`);
        if (update.currentVersion) {
          setCurrentVersion(
            update.currentVersion.startsWith("v")
              ? update.currentVersion
              : `v${update.currentVersion}`
          );
        }
        setReleaseNotes(update.body || "Pembaruan stabilitas dan peningkatan performa sistem.");
        setState("available");
      } else {
        setState("up_to_date");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("[UPDATER ERROR]", err);
      const msg = typeof err === "string" ? err : String(err);
      if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setErrorMessage("Tidak dapat terhubung ke server pembaruan GitHub. Periksa koneksi internet Anda.");
      } else {
        setErrorMessage(msg);
      }
      setState("error");
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      checkForUpdates();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [open]);

  const handleStartUpdate = async () => {
    if (!updateObj) return;
    setState("downloading");
    setDownloadProgress(0);
    setDownloadedBytes(0);

    try {
      let downloaded = 0;
      let total = 0;

      await updateObj.downloadAndInstall((event) => {
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
              const pct = Math.min(100, Math.round((downloaded / total) * 100));
              setDownloadProgress(pct);
            }
            break;
          case "Finished":
            setDownloadProgress(100);
            break;
        }
      });

      if (mountedRef.current) {
        setState("ready_to_restart");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("[DOWNLOAD ERROR]", err);
      setErrorMessage(typeof err === "string" ? err : "Gagal mengunduh atau memasang pembaruan.");
      setState("error");
    }
  };

  const handleRelaunch = async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error("[RELAUNCH ERROR]", err);
      alert("Pembaruan telah terpasang. Silakan tutup dan buka ulang aplikasi.");
    }
  };

  if (!open) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <img
              src={logoKotaMagelang}
              alt="Logo Kota Magelang"
              className="h-8 w-auto object-contain drop-shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Pembaruan Sistem SIMBASI BMD
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-100 dark:border-indigo-800">
                  Auto Updater
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pemerintah Kota Magelang — BPKAD
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={state === "downloading"}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          
          {/* STATE 1: CHECKING */}
          {state === "checking" && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="relative flex items-center justify-center">
                <div className="h-14 w-14 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <RefreshCw className="h-7 w-7 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Memeriksa Pembaruan...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Menghubungi repositori rilis resmi untuk memverifikasi versi terbaru.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: UP TO DATE */}
          {state === "up_to_date" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Aplikasi Sudah Menggunakan Versi Terbaru
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Saat ini Anda menggunakan <span className="font-semibold text-slate-700 dark:text-slate-300">SIMBASI BMD {currentVersion}</span>. Tidak ada pembaruan yang diperlukan.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 w-full flex items-center justify-between font-mono">
                <span>Versi Terpasang:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{currentVersion}</span>
              </div>
            </div>
          )}

          {/* STATE 3: UPDATE AVAILABLE */}
          {state === "available" && (
            <div className="space-y-4">
              {/* Badge Perbandingan Versi */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                      Versi Baru Tersedia!
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 font-mono text-xs">
                      <span className="text-slate-500 dark:text-slate-400 line-through">{currentVersion}</span>
                      <ArrowRight className="h-3 w-3 text-indigo-500" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{targetVersion}</span>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                  Rilis Resmi
                </span>
              </div>

              {/* Catatan Perubahan (Changelog) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Catatan Rilis & Pembaruan
                </label>
                <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-line leading-relaxed font-sans">
                  {releaseNotes}
                </div>
              </div>
            </div>
          )}

          {/* STATE 4: DOWNLOADING */}
          {state === "downloading" && (
            <div className="space-y-4 py-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <DownloadCloud className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-bounce" />
                  Mengunduh Pembaruan ({targetVersion})...
                </div>
                <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {downloadProgress}%
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300 shadow-sm"
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

          {/* STATE 5: READY TO RESTART */}
          {state === "ready_to_restart" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Pembaruan Siap Diterapkan!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Berkas pembaruan telah berhasil dipasang. Buka ulang aplikasi sekarang untuk beralih ke versi <span className="font-bold text-emerald-600 dark:text-emerald-400">{targetVersion}</span>.
                </p>
              </div>
            </div>
          )}

          {/* STATE 6: ERROR */}
          {state === "error" && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Gagal Memeriksa / Mengunduh Pembaruan
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                {errorMessage || "Terjadi kesalahan pada layanan update."}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <div>
            {(state === "error" || state === "up_to_date") && (
              <button
                type="button"
                onClick={checkForUpdates}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Periksa Ulang
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {state === "available" && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Nanti Saja
                </button>
                <button
                  type="button"
                  onClick={handleStartUpdate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <DownloadCloud className="h-4 w-4" />
                  Unduh & Pasang Sekarang
                </button>
              </>
            )}

            {state === "ready_to_restart" && (
              <button
                type="button"
                onClick={handleRelaunch}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Mulai Ulang Aplikasi Sekarang
              </button>
            )}

            {(state === "up_to_date" || state === "error" || state === "checking") && (
              <button
                type="button"
                onClick={onClose}
                disabled={state === "downloading"}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
