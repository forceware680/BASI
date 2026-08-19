// components/StatusBadge.tsx — badge status (kuning/hijau) dengan dot indicator dan dark mode.

import type { StatusTandaTerima } from "../lib/types";

export function StatusBadge({
  status,
}: {
  status: StatusTandaTerima;
}) {
  if (status === "SELESAI") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
        SELESAI
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
      MENUNGGU BUKTI
    </span>
  );
}
