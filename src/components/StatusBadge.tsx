// components/StatusBadge.tsx — badge status (kuning/hijau).

import type { StatusTandaTerima } from "../lib/types";

export function StatusBadge({
  status,
}: {
  status: StatusTandaTerima;
}) {
  if (status === "SELESAI") {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
        SELESAI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
      MENUNGGU_BUKTI
    </span>
  );
}
