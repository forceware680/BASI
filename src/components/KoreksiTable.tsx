// components/KoreksiTable.tsx — tabel utama responsif dengan compact action group, floating portal menu, dan dark mode.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { formatTanggal } from "../lib/types";
import type { KoreksiRow, StatusTandaTerima } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import {
  Search,
  Printer,
  Upload,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Plus,
  RefreshCw,
  MoreHorizontal,
  FileUp,
} from "lucide-react";

const PAGE_SIZE = 20;

const COLUMNS = [
  { id: "no_ba", header: "No. BA Koreksi" },
  { id: "no_tu", header: "No. Surat TU" },
  { id: "opd", header: "OPD Pengusul" },
  { id: "tanggal", header: "Tanggal Surat" },
  { id: "status", header: "Status Sirkulasi" },
  { id: "diinput_oleh", header: "Diinput Oleh" },
  { id: "aksi", header: "Aksi Dokumen" },
];

export function KoreksiTable({
  rows,
  uploadingId,
  onPrint,
  onUpload,
  onView,
  onEdit,
  onDelete,
  onAddNew,
}: {
  rows: KoreksiRow[];
  uploadingId?: string | null;
  onPrint: (row: KoreksiRow) => void;
  onUpload: (row: KoreksiRow) => void;
  onView: (row: KoreksiRow) => void;
  onEdit: (row: KoreksiRow) => void;
  onDelete: (row: KoreksiRow) => void;
  onAddNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"semua" | StatusTandaTerima>("semua");
  const [page, setPage] = useState(0);
  
  // State floating menu anchored via DOM coordinates & portal
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    rect: DOMRect;
    row: KoreksiRow;
  } | null>(null);

  // Tutup menu saat klik di luar, scroll, atau resize
  useEffect(() => {
    const handleDismiss = () => setMenuAnchor(null);
    window.addEventListener("click", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      window.removeEventListener("click", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "semua" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.no_ba.toLowerCase().includes(q) ||
        r.no_tu.toLowerCase().includes(q) ||
        r.nama_opd.toLowerCase().includes(q) ||
        r.penjelasan_koreksi.toLowerCase().includes(q) ||
        (r.created_by_name && r.created_by_name.toLowerCase().includes(q))
      );
    });
  }, [rows, search, statusFilter]);

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination: { pageSize: PAGE_SIZE, pageIndex: page },
      sorting: [],
    },
  });

  const rowModel = table.getRowModel();
  const totalPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const canNext = page + 1 < totalPage;

  return (
    <div className="space-y-4">
      {/* Toolbar Filter & Pencarian */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm transition-colors">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Input Search */}
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Cari No. BA, No. TU, OPD, uraian, petugas..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 py-2 pl-9 pr-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Status Pills */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 text-xs font-medium text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-nowrap">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("semua");
                setPage(0);
              }}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                statusFilter === "semua"
                  ? "bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white shadow-sm"
                  : "hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Semua ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("MENUNGGU_BUKTI");
                setPage(0);
              }}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                statusFilter === "MENUNGGU_BUKTI"
                  ? "bg-white dark:bg-slate-800 font-semibold text-amber-800 dark:text-amber-300 shadow-sm"
                  : "hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Menunggu Bukti ({rows.filter((r) => r.status === "MENUNGGU_BUKTI").length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("SELESAI");
                setPage(0);
              }}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                statusFilter === "SELESAI"
                  ? "bg-white dark:bg-slate-800 font-semibold text-emerald-800 dark:text-emerald-300 shadow-sm"
                  : "hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Selesai ({rows.filter((r) => r.status === "SELESAI").length})
            </button>
          </div>
        </div>

        {/* Info Total Terfilter */}
        <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap text-right">
          Menampilkan <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> dari{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{rows.length}</span> berkas
        </div>
      </div>

      {/* Tabel Kontainer Card Responsif */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <th className="px-4 py-3.5 w-36">No. BA Koreksi</th>
                <th className="px-4 py-3.5 w-36">No. Surat TU</th>
                <th className="px-4 py-3.5 min-w-[220px]">OPD Pengusul</th>
                <th className="px-4 py-3.5 w-32">Tanggal Surat</th>
                <th className="px-4 py-3.5 w-36">Status</th>
                <th className="px-4 py-3.5 min-w-[180px]">Diinput Oleh</th>
                <th className="px-4 py-3.5 w-36 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {rowModel.rows.map((row) => {
                const r = row.original;
                const isUploading = uploadingId === r.id;
                const isMenuOpen = menuAnchor?.id === r.id;

                const creatorName = r.created_by_name || "Administrator";
                const isCreatorAdmin = r.created_by_role === "ADMIN" || (!r.created_by_role && !r.created_by_name);

                return (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-indigo-50/30 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-indigo-950 dark:text-indigo-300">
                        {r.no_ba}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.no_tu}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100 leading-snug">{r.nama_opd}</div>
                      {r.penjelasan_koreksi && (
                        <div className="max-w-md truncate text-xs text-slate-400 dark:text-slate-500 mt-0.5" title={r.penjelasan_koreksi}>
                          {r.penjelasan_koreksi}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatTanggal(r.tanggal_surat)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={r.status} />
                    </td>
                    {/* Kolom Diinput Oleh: Format Nama [Role Badge] */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs text-slate-800 dark:text-slate-200">
                          {creatorName}
                        </span>
                        {isCreatorAdmin ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                            Admin
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                            Operator
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {/* Compact Icon-Only Action Group */}
                      <div className="inline-flex items-center justify-center gap-1.5">
                        {/* Tombol Cetak (Icon Only) */}
                        <button
                          type="button"
                          onClick={() => onPrint(r)}
                          title="Cetak Lembar Ekspedisi Tunggal"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* Tombol Kontekstual Status: Upload Bukti vs Lihat Bukti (Icon Only) */}
                        {r.status === "MENUNGGU_BUKTI" ? (
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => onUpload(r)}
                            title="Unggah Scan Tanda Terima Ekspedisi"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-indigo-600 bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isUploading ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onView(r)}
                            title="Lihat Berkas Bukti Scan"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shadow-sm transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}

                        {/* Tombol Trigger Opsi Lainnya (•••) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMenuOpen) {
                              setMenuAnchor(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuAnchor({ id: r.id, rect, row: r });
                            }
                          }}
                          title="Opsi lainnya"
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border text-slate-500 dark:text-slate-400 transition-colors shadow-sm ${
                            isMenuOpen
                              ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100"
                          }`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Tampilan Kosong (Empty State) */}
              {rowModel.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                        <FileQuestion className="h-7 w-7" />
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                        {search || statusFilter !== "semua"
                          ? "Data Tidak Ditemukan"
                          : "Belum Ada Berkas BA Koreksi"}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {search || statusFilter !== "semua"
                          ? "Coba ubah kata kunci pencarian atau reset filter status."
                          : "Mulai dengan mencatat Berita Acara Koreksi BMD baru untuk mencetak tanda terima ekspedisi."}
                      </p>
                      {search || statusFilter !== "semua" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("semua");
                          }}
                          className="mt-4 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Reset Filter
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onAddNew}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700"
                        >
                          <Plus className="h-4 w-4" />
                          Tambah Koreksi Pertama
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Halaman <span className="font-semibold text-slate-800 dark:text-slate-200">{page + 1}</span> dari{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPage}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Selanjutnya
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Menu (React Portal - Anti Terpotong Tabel) */}
      {menuAnchor &&
        createPortal(
          (() => {
            const menuHeight = 140; // perkiraan tinggi popup menu
            const openUpwards = menuAnchor.rect.bottom + menuHeight > window.innerHeight;
            const top = openUpwards
              ? menuAnchor.rect.top - menuHeight - 4
              : menuAnchor.rect.bottom + 4;
            const left = Math.max(8, menuAnchor.rect.right - 176); // 176px = w-44

            const r = menuAnchor.row;
            const isUploading = uploadingId === r.id;

            return (
              <div
                className="fixed z-[9999] w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-2xl text-left animate-in fade-in-50 zoom-in-95"
                style={{ top: `${top}px`, left: `${left}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Edit Data */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuAnchor(null);
                    onEdit(r);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Edit2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Edit Data</span>
                </button>

                {/* Ganti Bukti (Jika status SELESAI) */}
                {r.status === "SELESAI" && (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => {
                      setMenuAnchor(null);
                      onUpload(r);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <FileUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <span>Ganti Bukti Scan</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                {/* Hapus Data */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuAnchor(null);
                    onDelete(r);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  <span>Hapus Berkas</span>
                </button>
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
}
