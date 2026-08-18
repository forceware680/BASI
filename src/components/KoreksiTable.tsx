// components/KoreksiTable.tsx — tabel utama (REQ-05) — TanStack Table.
//
//  Kolom: No. BA, No. TU, OPD, Tanggal, Status, Aksi.
//  Toolbar: search global (no_ba / no_tu / nama OPD) + filter status.
//  Urut created_at DESC (di backend). TanStack Table + pagination 20/halaman [ASUMSI].

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { formatTanggal } from "../lib/types";
import type { KoreksiRow } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

const btn = "rounded px-2 py-1 text-xs font-medium border transition-colors";

function ActionBtn({
  variant,
  onClick,
  children,
}: {
  variant: "default" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  const cls =
    variant === "danger"
      ? `${btn} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`
      : `${btn} border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

const PAGE_SIZE = 20;

const COLUMNS = [
  { id: "no_ba", header: "No. BA" },
  { id: "no_tu", header: "No. TU" },
  { id: "opd", header: "OPD" },
  { id: "tanggal", header: "Tanggal" },
  { id: "status", header: "Status" },
  { id: "aksi", header: "Aksi" },
];

export function KoreksiTable({
  rows,
  onPrint,
  onUpload,
  onView,
  onEdit,
  onDelete,
}: {
  rows: KoreksiRow[];
  onPrint: (row: KoreksiRow) => void;
  onUpload: (row: KoreksiRow) => void;
  onView: (row: KoreksiRow) => void;
  onEdit: (row: KoreksiRow) => void;
  onDelete: (row: KoreksiRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "semua" | "MENUNGGU_BUKTI" | "SELESAI"
  >("semua");
  const [page, setPage] = useState(0);

  // Filter UI (search + status) sebelum masuk TanStack Table.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "semua" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.no_ba.toLowerCase().includes(q) ||
        r.no_tu.toLowerCase().includes(q) ||
        r.nama_opd.toLowerCase().includes(q)
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
  const totalPage = Math.max(1, Math.ceil(rowModel.rows.length / PAGE_SIZE));
  const canNext = page + 1 < totalPage;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar (NFR-05: satu layar utama) */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari No. BA / No. TU / OPD…"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          <option value="semua">Semua</option>
          <option value="MENUNGGU_BUKTI">MENUNGGU_BUKTI</option>
          <option value="SELESAI">SELESAI</option>
        </select>
      </div>

      {/* Tabel */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              {COLUMNS.map((col) => (
                <th key={col.id} className="px-3 py-2">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowModel.rows.map((row) => {
              const r = row.original;
              return (
                <tr key={r.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2 font-mono">{r.no_ba}</td>
                  <td className="px-3 py-2">{r.no_tu}</td>
                  <td className="px-3 py-2">{r.nama_opd}</td>
                  <td className="px-3 py-2">{formatTanggal(r.tanggal_surat)}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <ActionBtn variant="default" onClick={() => onPrint(r)}>Cetak</ActionBtn>
                      <ActionBtn variant="default" onClick={() => onUpload(r)}>
                        {r.status === "SELESAI" ? "Ganti Bukti" : "Upload Bukti"}
                      </ActionBtn>
                      {r.file_name && (
                        <ActionBtn variant="default" onClick={() => onView(r)}>Lihat</ActionBtn>
                      )}
                      {r.status === "MENUNGGU_BUKTI" && (
                        <>
                          <ActionBtn variant="default" onClick={() => onEdit(r)}>Edit</ActionBtn>
                          <ActionBtn variant="danger" onClick={() => onDelete(r)}>Hapus</ActionBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rowModel.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  Tidak ada record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (ASUMSI: 20 baris/halaman) */}
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <span>Halaman {page + 1} / {totalPage}</span>
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          ←
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          →
        </button>
      </div>
    </div>
  );
}
