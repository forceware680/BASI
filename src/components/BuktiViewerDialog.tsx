// components/BuktiViewerDialog.tsx — viewer file bukti (REQ-05).
//
//  Gambar (JPG/PNG) via base64 <img>; PDF via base64 <iframe>.
//  Task 4 (viewer) — stub sederhana di Task 2.

import { useEffect, useState } from "react";
import type { KoreksiRow } from "../lib/types";
import { getBuktiBase64 } from "../lib/api";

export function BuktiViewerDialog({
  row,
  onClose,
}: {
  row: KoreksiRow | null;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    setDataUrl(null);
    setError(null);
    getBuktiBase64(row.id)
      .then((res) => {
        if (cancelled) return;
        // res = (mime, data_url) sebagai [0,1]
        setMime(res[0]);
        setDataUrl(res[1]);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [row]);

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40">
      <div className="w-full max-w-4xl rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">
          Bukti — {row.no_ba}
        </h2>
        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}
        {dataUrl && mime === "application/pdf" && (
          <iframe
            src={dataUrl}
            className="h-[60vh] w-full rounded border border-zinc-200"
            title="Bukti PDF"
          />
        )}
        {dataUrl && mime?.startsWith("image/") && (
          <img
            src={dataUrl}
            alt="Bukti scan"
            className="max-h-[60vh] rounded border border-zinc-200"
          />
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
