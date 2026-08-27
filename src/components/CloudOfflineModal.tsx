// components/CloudOfflineModal.tsx — Popup tawaran beralih ke server lokal (offline)
// saat server cloud tidak dapat dihubungi. Ditampilkan di atas layar login maupun
// dashboard, sehingga pengguna tetap dapat beralih dan login ke basis data offline.

import { useEffect } from "react";
import { CloudOff, HardDrive, Loader2, X } from "lucide-react";

export function CloudOfflineModal({
  open,
  switching = false,
  onSwitch,
  onRetry,
  onClose,
}: {
  open: boolean;
  switching?: boolean;
  onSwitch: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  // Shortcut Escape (dihambat saat proses beralih sedang berlangsung)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !switching) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, switching, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !switching) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        {/* Header Icon */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60 shadow-sm">
              <CloudOff className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Server Cloud Offline
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Server cloud tidak dapat dihubungi
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={switching}
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="my-4 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-3.5">
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            Anda sedang pada <span className="font-semibold">Mode Online</span>, namun
            server cloud tidak dapat dihubungi. Beralih ke{" "}
            <span className="font-semibold">server lokal (offline)</span> untuk terus
            menggunakan aplikasi dan masuk menggunakan data lokal.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={switching}
            onClick={onRetry}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Coba Ulangi
          </button>
          <button
            type="button"
            disabled={switching}
            onClick={onSwitch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {switching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HardDrive className="h-3.5 w-3.5" />
            )}
            {switching ? "Membuka Server Lokal…" : "Beralih ke Server Lokal"}
          </button>
        </div>
      </div>
    </div>
  );
}
