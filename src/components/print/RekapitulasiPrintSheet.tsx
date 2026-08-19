// components/print/RekapitulasiPrintSheet.tsx — Lembar Cetak Rekapitulasi Laporan Periode.

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { KoreksiRow } from "../../lib/types";
import { formatTanggal } from "../../lib/types";
import logoKotaMagelang from "../../assets/logo-kota-magelang.png";
import { Printer, X } from "lucide-react";

export function RekapitulasiPrintSheet({
  rows,
  dateFrom,
  dateTo,
  statusLabel,
  opdLabel,
  onClose,
}: {
  rows: KoreksiRow[];
  dateFrom: string;
  dateTo: string;
  statusLabel: string;
  opdLabel: string;
  onClose: () => void;
}) {
  const printed = useRef(false);

  useEffect(() => {
    if (printed.current) return;
    printed.current = true;
    const timer = setTimeout(() => {
      window.print();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return createPortal(
    <div className="print-overlay-root fixed inset-0 z-50 overflow-auto bg-slate-900/60 backdrop-blur-sm">
      <div className="mx-auto my-6 w-fit">
        {/* Toolbar Cetak */}
        <div className="print-toolbar mb-3 flex items-center justify-between rounded-xl bg-white p-3 shadow-lg">
          <span className="text-xs font-semibold text-slate-700">
            Pratinjau Laporan Rekapitulasi ({rows.length} berkas)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Tutup
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak Laporan
            </button>
          </div>
        </div>

        {/* Halaman Cetak Rekapitulasi */}
        <div
          id="rekapitulasi-print-sheet"
          className="w-[297mm] min-h-[210mm] bg-white p-8 text-black shadow-2xl font-serif text-[10pt] leading-normal"
          style={{ boxSizing: "border-box" }}
        >
          {/* KOP RESMI PEMKOT MAGELANG */}
          <div className="flex items-center gap-4 pb-2">
            <img
              src={logoKotaMagelang}
              alt="Logo Kota Magelang"
              className="h-16 w-auto object-contain"
            />
            <div className="flex-1 text-center font-serif">
              <div className="text-xs font-bold tracking-wider uppercase">
                Pemerintah Kota Magelang
              </div>
              <div className="text-sm font-extrabold uppercase tracking-wide">
                Badan Pengelolaan Keuangan dan Aset Daerah
              </div>
              <div className="text-[9pt] font-semibold text-slate-800">
                Bidang Aset
              </div>
              <div className="text-[9pt] font-semibold text-slate-800">
                Kasubid Penatausahaan Aset
              </div>
              <div className="text-[8pt] italic text-slate-700 mt-0.5 leading-tight">
                Jl. Jend. Sarwo Edhie Wibowo No.2, Tenjosari, Magersari, Kec. Magelang Sel., Kabupaten Magelang, Jawa Tengah 56172, Telp. (0293) 363530
              </div>
            </div>
          </div>

          <div className="mb-4 border-b-2 border-t border-black py-[1px]" />

          {/* Judul Laporan */}
          <div className="text-center mb-4">
            <div className="text-sm font-bold uppercase tracking-wide">
              Laporan Rekapitulasi Pelacakan Ekspedisi BA Koreksi BMD
            </div>
            <div className="text-xs font-sans mt-1">
              Periode: <span className="font-semibold">{dateFrom ? formatTanggal(dateFrom) : "Awal"}</span> s/d{" "}
              <span className="font-semibold">{dateTo ? formatTanggal(dateTo) : "Sekarang"}</span>
              {statusLabel !== "Semua" && <span> | Status: <b>{statusLabel}</b></span>}
              {opdLabel !== "Semua OPD" && <span> | OPD: <b>{opdLabel}</b></span>}
            </div>
          </div>

          {/* Tabel Rekapitulasi */}
          <table className="w-full border-collapse border border-black text-[9pt] font-sans mb-6">
            <thead>
              <tr className="bg-slate-100/60 text-center font-bold text-[8.5pt]">
                <th className="border border-black px-2 py-1.5 w-8">No</th>
                <th className="border border-black px-2 py-1.5">No. BA Koreksi</th>
                <th className="border border-black px-2 py-1.5">No. Surat TU</th>
                <th className="border border-black px-2 py-1.5">OPD Pengusul</th>
                <th className="border border-black px-2 py-1.5 w-24">Tgl Surat</th>
                <th className="border border-black px-2 py-1.5">Uraian Koreksi</th>
                <th className="border border-black px-2 py-1.5 w-28">Status</th>
                <th className="border border-black px-2 py-1.5 w-28">Bukti Scan Ekspedisi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="align-top">
                  <td className="border border-black px-2 py-1 text-center font-mono text-[8pt]">{idx + 1}</td>
                  <td className="border border-black px-2 py-1 font-mono text-[8pt] font-semibold">{r.no_ba}</td>
                  <td className="border border-black px-2 py-1 font-mono text-[8pt]">{r.no_tu}</td>
                  <td className="border border-black px-2 py-1 font-semibold">{r.nama_opd}</td>
                  <td className="border border-black px-2 py-1 text-center text-[8pt]">{formatTanggal(r.tanggal_surat)}</td>
                  <td className="border border-black px-2 py-1 text-[8pt] whitespace-pre-wrap">{r.penjelasan_koreksi}</td>
                  <td className="border border-black px-2 py-1 text-center text-[8pt] font-bold">
                    {r.status === "SELESAI" ? "SELESAI" : "MENUNGGU BUKTI"}
                  </td>
                  <td className="border border-black px-2 py-1 text-center text-[8pt] font-semibold">
                    {r.file_path || r.status === "SELESAI" ? (
                      <span className="text-emerald-800">Ada</span>
                    ) : (
                      <span className="text-slate-500">Belum Ada</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-black px-4 py-8 text-center text-slate-500 italic">
                    Tidak ada data Berita Acara Koreksi pada periode yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Area Tanda Tangan Pengesahan */}
          <div className="mt-8 flex justify-end font-serif">
            <div className="text-center w-72">
              <div>Magelang, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
              <div className="font-bold text-[10pt] mt-1">Kepala Bidang Aset</div>
              <div className="text-[9pt]">BPKAD Kota Magelang</div>
              <div className="h-20" />
              <div className="font-bold underline text-[10pt]">( ............................................................ )</div>
              <div className="text-[9pt]">NIP. .......................................................</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
