// components/print/EkspedisiPrintSheet.tsx — Lembar Cetak Ekspedisi Tunggal (REQ-03, Kop Resmi Pemkot Magelang).

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { KoreksiRow } from "../../lib/types";
import { formatTanggal } from "../../lib/types";
import logoKotaMagelang from "../../assets/logo-kota-magelang.png";
import { Printer, X } from "lucide-react";

export function EkspedisiPrintSheet({
  row,
  onClose,
}: {
  row: KoreksiRow | null;
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

  if (!row) return null;

  return createPortal(
    <div className="print-overlay-root fixed inset-0 z-50 overflow-auto bg-slate-900/60 backdrop-blur-sm">
      <div className="mx-auto my-6 w-fit">
        {/* Toolbar dialog */}
        <div className="print-toolbar mb-3 flex items-center justify-between rounded-xl bg-white p-3 shadow-lg">
          <span className="text-xs font-semibold text-slate-700">
            Pratinjau Lembar Ekspedisi: <span className="font-mono text-indigo-600">{row.no_ba}</span>
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
              Cetak Sekarang
            </button>
          </div>
        </div>

        {/* Lembar Cetak Dinas */}
        <div
          id="ekspedisi-print-sheet"
          className="w-[210mm] max-w-full bg-white p-8 text-black shadow-2xl font-serif text-[11pt] leading-normal"
          style={{ boxSizing: "border-box" }}
        >
          {/* KOP DINAS RESMI PEMKOT MAGELANG */}
          <div className="flex flex-col items-center text-center pb-2 font-serif">
            <img
              src={logoKotaMagelang}
              alt="Logo Kota Magelang"
              className="h-16 w-auto object-contain mb-1.5"
            />
            <div className="text-sm font-bold tracking-wider uppercase">
              Pemerintah Kota Magelang
            </div>
            <div className="text-base font-extrabold uppercase tracking-wide">
              Badan Pengelolaan Keuangan dan Aset Daerah
            </div>
            <div className="text-xs font-semibold text-slate-800">
              Bidang Aset
            </div>
            <div className="text-xs font-semibold text-slate-800">
              Kasubid Penatausahaan Aset
            </div>
            <div className="text-[8.5pt] italic text-slate-700 mt-1 max-w-xl leading-tight">
              Jl. Jend. Sarwo Edhie Wibowo No.2, Tenjosari, Magersari, Kec. Magelang Sel., Kabupaten Magelang, Jawa Tengah 56172, Telp. (0293) 363530
            </div>
          </div>

          {/* Garis Ganda Standar Dinas */}
          <div className="mb-4 border-b-2 border-t border-black py-[1px]" />

          {/* Judul Dokumen */}
          <div className="text-center mb-4">
            <div className="text-base font-bold uppercase tracking-wide underline underline-offset-4">
              Tanda Terima Ekspedisi
            </div>
            <div className="text-sm font-bold uppercase mt-1">
              Berita Acara Koreksi Barang Milik Daerah (BMD)
            </div>
            <div className="text-xs mt-1 font-sans">
              Nomor BA: <span className="font-mono font-bold text-sm">{row.no_ba}</span>
            </div>
          </div>

          {/* Tabel Informasi Berkas */}
          <div className="border border-black mb-4">
            <div
              style={{ display: "grid", gridTemplateColumns: "180px 1fr" }}
              className="border-b border-black"
            >
              <div className="bg-slate-100/50 p-2 font-bold text-xs border-r border-black font-sans">
                No. Surat TU BPKAD
              </div>
              <div className="p-2 font-mono text-xs">{row.no_tu}</div>
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "180px 1fr" }}
              className="border-b border-black"
            >
              <div className="bg-slate-100/50 p-2 font-bold text-xs border-r border-black font-sans">
                No. BA Koreksi
              </div>
              <div className="p-2 font-mono text-xs font-bold">{row.no_ba}</div>
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "180px 1fr" }}
              className="border-b border-black"
            >
              <div className="bg-slate-100/50 p-2 font-bold text-xs border-r border-black font-sans">
                OPD Pengusul
              </div>
              <div className="p-2 text-xs font-bold">{row.nama_opd}</div>
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "180px 1fr" }}
              className="border-b border-black"
            >
              <div className="bg-slate-100/50 p-2 font-bold text-xs border-r border-black font-sans">
                Tanggal Surat
              </div>
              <div className="p-2 text-xs">{formatTanggal(row.tanggal_surat)}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr" }}>
              <div className="bg-slate-100/50 p-2 font-bold text-xs border-r border-black font-sans">
                Uraian Koreksi BMD
              </div>
              <div className="p-2 text-xs whitespace-pre-wrap leading-relaxed">
                {row.penjelasan_koreksi}
              </div>
            </div>
          </div>

          {/* 3 Kotak Tanda Tangan & Cap Berdampingan */}
          <div className="mb-4">
            <div className="text-xs font-bold font-sans uppercase mb-2">
              Lembar Pengesahan & Tanda Terima Sirkulasi:
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px",
              }}
            >
              {/* Kotak 1 */}
              <div className="border border-black p-3 flex flex-col justify-between h-[5.2cm]">
                <div className="text-center">
                  <div className="text-[10pt] font-bold">Asman Kepala OPD</div>
                  <div className="text-[8.5pt] text-slate-700 mt-0.5">(Tanda Tangan & Cap Dinas)</div>
                </div>
                <div className="text-[8.5pt] font-sans space-y-1">
                  <div>Nama : ........................................</div>
                  <div>Tgl &nbsp; : ........................................</div>
                </div>
              </div>

              {/* Kotak 2 */}
              <div className="border border-black p-3 flex flex-col justify-between h-[5.2cm]">
                <div className="text-center">
                  <div className="text-[10pt] font-bold">Bidang Akuntansi</div>
                  <div className="text-[8.5pt] text-slate-700 mt-0.5">BPKAD Kota Magelang</div>
                </div>
                <div className="text-[8.5pt] font-sans space-y-1">
                  <div>Nama : ........................................</div>
                  <div>Tgl &nbsp; : ........................................</div>
                </div>
              </div>

              {/* Kotak 3 */}
              <div className="border border-black p-3 flex flex-col justify-between h-[5.2cm]">
                <div className="text-center">
                  <div className="text-[10pt] font-bold">OPD Pemohon</div>
                  <div className="text-[8.5pt] text-slate-700 mt-0.5">(Tanda Terima BA Final)</div>
                </div>
                <div className="text-[8.5pt] font-sans space-y-1">
                  <div>Nama : ........................................</div>
                  <div>Tgl &nbsp; : ........................................</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Dokumen */}
          <div className="mt-4 border-t border-black pt-2 text-[8pt] font-mono text-slate-600 flex justify-end">
            <div>
              Dicetak: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
