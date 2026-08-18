// components/print/EkspedisiPrintSheet.tsx — dialog cetak 1 halaman (REQ-03).
//
//  Diporalkan ke <body> (portal) supaya lembar cetaknya jadi saudara dari
//  #root, bukan di dalam flex app. Print CSS lalu: sembunyikan #root (app) +
//  toolbar dialog, netral-kan backdrop, dan tampilkan hanya #ekspedisi-print-sheet.
//  A4 portrait, 3 kolom TTD berdampingan (Asman OPD / Akuntansi / OPD Pemohon).
//
//  Layout grid di-drive inline-style (bukan Tailwind class) agar tidak
//  di-hapus oleh override print "display:block" (inline style menang atas
//  stylesheet rule).

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { KoreksiRow } from "../../lib/types";
import { formatTanggal } from "../../lib/types";

export function EkspedisiPrintSheet({
  row,
  onClose,
}: {
  row: KoreksiRow | null;
  onClose: () => void;
}) {
  // Auto-buka print dialog saat lembar dibuka (ref guard: StrictMode
  // double-invoke efek — cuma print 1x per mount).
  const printed = useRef(false);
  useEffect(() => {
    if (printed.current) return;
    printed.current = true;
    window.print();
  }, []);

  if (!row) return null;

  return createPortal(
    <div className="print-overlay-root fixed inset-0 z-50 overflow-auto bg-zinc-900/40">
      <div className="mx-auto my-6 w-fit">
        {/* Toolbar dialog — tidak ikut tercetak */}
        <div className="print-toolbar mb-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-indigo-600 px-4 py-1 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Cetak
          </button>
        </div>

        {/* Lembar cetak — SATU-SATUNYA yang dicetak (id #ekspedisi-print-sheet) */}
        <div id="ekspedisi-print-sheet" className="bg-white p-8 text-black">
          {/* KOP DINAS */}
          <div className="border-b-2 border-black pb-2 text-center">
            <div className="text-sm font-semibold tracking-wide">
              BADAN PENGELOLAAN KEUANGAN DAN ASET DAERAH
            </div>
            <div className="text-xs">Subid Penatausahaan Aset</div>
            <div className="mt-1 border-t border-black" />
          </div>

          {/* Judul */}
          <div className="mt-6 text-center">
            <div className="text-base font-bold">TANDA TERIMA EKSPEDISI</div>
            <div className="text-sm">
              BERITA ACARA KOREKSI BARANG MILIK DAERAH
            </div>
            <div className="mt-2 text-sm">
              Nomor BA: <span className="font-semibold">{row.no_ba}</span>
            </div>
          </div>

          {/* Tabel informasi */}
          <div className="mt-6">
            <Row label="No. Surat TU BPKAD" value={row.no_tu} />
            <Row label="No. BA Koreksi" value={row.no_ba} />
            <Row label="OPD Pengusul" value={row.nama_opd} />
            <Row label="Tanggal Surat" value={formatTanggal(row.tanggal_surat)} />
            <Row label="Uraian Koreksi" value={row.penjelasan_koreksi} />
          </div>

          {/* 3 kolom TTD */}
          <div
            className="mt-8"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5cm" }}
          >
            <TtdCol label="Asman Kepala OPD (TTD & Cap)" />
            <TtdCol label="Bidang Akuntansi BPKAD" />
            <TtdCol label="OPD Pemohon (Tanda Terima Final)" />
          </div>

          {/* Catatan kaki */}
          <div className="mt-10 text-xs">
            Arsip BA final: 2 rangkap disimpan di Bidang Aset BPKAD.
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "160px 1fr" }}
      className="border-b border-black"
    >
      <div className="px-2 py-1 text-xs">{label}</div>
      <div className="px-2 py-1 text-xs">{value}</div>
    </div>
  );
}

function TtdCol({ label }: { label: string }) {
  return (
    <div className="border border-black p-2">
      <div className="text-xs font-semibold">{label}</div>
      <div className="h-[6cm] border-b border-dashed border-black" />
      <div className="mt-2 text-xs">Nama: ______________</div>
      <div className="text-xs">NIP: ______________</div>
      <div className="text-xs">Tgl: ______________</div>
    </div>
  );
}
