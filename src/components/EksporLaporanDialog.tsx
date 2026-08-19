// components/EksporLaporanDialog.tsx — Dialog Ekspor & Rekapitulasi Laporan Berdasarkan Periode dengan Dark Mode.

import { useEffect, useState } from "react";
import type { KoreksiRow, Opd, StatusTandaTerima } from "../lib/types";
import { formatTanggal, todayIso } from "../lib/types";
import { listOpd } from "../lib/api";
import {
  FileSpreadsheet,
  Printer,
  X,
  Calendar,
  Filter,
  Download,
  FileCheck2,
} from "lucide-react";

export function EksporLaporanDialog({
  open,
  allRows,
  onClose,
  onPrintReport,
}: {
  open: boolean;
  allRows: KoreksiRow[];
  onClose: () => void;
  onPrintReport: (
    filtered: KoreksiRow[],
    dateFrom: string,
    dateTo: string,
    statusLabel: string,
    opdLabel: string
  ) => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState<"semua" | StatusTandaTerima>("semua");
  const [opdId, setOpdId] = useState<string>("semua");
  const [opdList, setOpdList] = useState<Opd[]>([]);

  // Default tanggal_dari: tanggal 1 bulan berjalan
  useEffect(() => {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    setDateFrom(firstDay);
    setDateTo(todayIso());
  }, [open]);

  // Muat daftar OPD untuk filter
  useEffect(() => {
    listOpd().then(setOpdList).catch(console.error);
  }, []);

  // Shortcut Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // Filter data sesuai kriteria dialog
  const getFilteredData = () => {
    return allRows.filter((r) => {
      if (dateFrom && r.tanggal_surat < dateFrom) return false;
      if (dateTo && r.tanggal_surat > dateTo) return false;
      if (statusFilter !== "semua" && r.status !== statusFilter) return false;
      if (opdId !== "semua" && r.opd_id !== Number(opdId)) return false;
      return true;
    });
  };

  const filteredData = getFilteredData();
  const selectedOpdName =
    opdId === "semua"
      ? "Semua OPD"
      : opdList.find((o) => o.id === Number(opdId))?.nama_opd ?? "Semua OPD";
  const statusLabel =
    statusFilter === "semua"
      ? "Semua Status"
      : statusFilter === "SELESAI"
      ? "Selesai"
      : "Menunggu Bukti";

  // Ekspor Excel/CSV dengan BOM UTF-8
  const handleExportCsv = () => {
    const data = getFilteredData();
    if (data.length === 0) {
      alert("Tidak ada data pada periode dan filter yang dipilih.");
      return;
    }

    const headers = [
      "No",
      "No. BA Koreksi",
      "No. Surat TU BPKAD",
      "OPD Pengusul",
      "Tanggal Surat",
      "Status Sirkulasi",
      "Uraian / Penjelasan Koreksi",
      "Bukti Scan Ekspedisi",
      "Waktu Pencatatan",
    ];

    const escapeCsv = (val: string | null | undefined) => {
      if (!val) return '""';
      return `"${val.replace(/"/g, '""')}"`;
    };

    const rows = data.map((r, index) => [
      index + 1,
      escapeCsv(r.no_ba),
      escapeCsv(r.no_tu),
      escapeCsv(r.nama_opd),
      escapeCsv(r.tanggal_surat),
      escapeCsv(r.status),
      escapeCsv(r.penjelasan_koreksi),
      escapeCsv(r.file_name ? "Ada" : "Belum Ada"),
      escapeCsv(r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : ""),
    ]);

    const csvContent =
      "\uFEFF" + // UTF-8 BOM untuk Excel
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rekap_BA_Koreksi_${dateFrom}_sd_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const data = getFilteredData();
    onPrintReport(data, dateFrom, dateTo, statusLabel, selectedOpdName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Ekspor & Rekapitulasi Laporan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Filter data Berita Acara berdasarkan rentang tanggal & status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Filter */}
        <div className="space-y-4 py-5">
          {/* Rentang Tanggal */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Periode Tanggal Surat:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">Dari Tanggal:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">Sampai Tanggal:</span>
                <input
                  type="date"
                  value={dateTo}
                  max={todayIso()}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          {/* Filter Status */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Filter className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Filter Status Sirkulasi:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="semua">Semua Status (Menunggu Bukti & Selesai)</option>
              <option value="MENUNGGU_BUKTI">Hanya MENUNGGU BUKTI (Dalam Sirkulasi Fisik)</option>
              <option value="SELESAI">Hanya SELESAI (Bukti Scan Sudah Diunggah)</option>
            </select>
          </div>

          {/* Filter OPD */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <FileCheck2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Filter OPD Pengusul:
            </label>
            <select
              value={opdId}
              onChange={(e) => setOpdId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="semua">Semua Organisasi Perangkat Daerah (OPD)</option>
              {opdList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama_opd} {o.singkatan ? `(${o.singkatan})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Ringkasan Hasil Filter */}
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/40 p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Jumlah data yang sesuai:</span>
              <span className="font-bold text-indigo-950 dark:text-indigo-300 text-sm">{filteredData.length} Berkas</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Periode: {dateFrom ? formatTanggal(dateFrom) : "Awal"} s/d {dateTo ? formatTanggal(dateTo) : "Hari ini"}
            </div>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={filteredData.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Unduh Excel (CSV)
          </button>
          <button
            type="button"
            disabled={filteredData.length === 0}
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Cetak Rekapitulasi
          </button>
        </div>
      </div>
    </div>
  );
}
