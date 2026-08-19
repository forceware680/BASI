// components/StatusBadge.tsx — badge status (kuning/hijau) dengan dot indicator.

import type { StatusTandaTerima } from "../lib/types";

export function StatusBadge({
  status,
}: {
  status: StatusTandaTerima;
}) {
  if (status === "SELESAI") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        SELESAI
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      MENUNGGU BUKTI
    </span>
  );
}
