// pages/KoreksiListPage.tsx — satu layar utama (NFR-05).
//
//  Toolbar: [🔍 Cari] [Filter Status ▾] [+ Tambah Koreksi]
//  Tabel TanStack + aksi per-baris (Cetak / Upload / Lihat / Edit / Hapus).

import { useCallback, useEffect, useState } from "react";
import type { KoreksiRow } from "../lib/types";
import { KoreksiTable } from "../components/KoreksiTable";
import { KoreksiFormDialog } from "../components/KoreksiFormDialog";
import { EkspedisiPrintSheet } from "../components/print/EkspedisiPrintSheet";
import { listKoreksi, deleteKoreksi, openBuktiPath } from "../lib/api";

type FormMode = "create" | "edit" | null;

export function KoreksiListPage() {
  const [rows, setRows] = useState<KoreksiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<FormMode>(null);
  const [editRow, setEditRow] = useState<KoreksiRow | null>(null);
  const [printRow, setPrintRow] = useState<KoreksiRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listKoreksi()
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => {
    return listKoreksi()
      .then((r) => {
        setRows(r);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const handlePrint = (row: KoreksiRow) => {
    setPrintRow(row);
  };

  const handleUpload = (row: KoreksiRow) => {
    // Task 4: file picker + upload_bukti. Placeholder untuk Task 2.
    if (row.status === "SELESAI") {
      if (!window.confirm("Ganti bukti lama?")) return;
    }
    window.confirm("Pilih file bukti (PDF/JPG/PNG ≤ 10 MB).");
  };

  const handleView = (row: KoreksiRow) => {
    if (!row.file_path) return;
    openBuktiPath(row.file_path).catch((e) =>
      window.alert("Gagal membuka bukti: " + e),
    );
  };

  const handleDelete = (row: KoreksiRow) => {
    if (!window.confirm("Hapus record ini?")) return;
    deleteKoreksi(row.id)
      .then(refresh)
      .catch((e) => setError(String(e)));
  };

  const handleEdit = (row: KoreksiRow) => {
    setEditRow(row);
    setFormOpen("edit");
  };

  const handleSaved = () => {
    setFormOpen(null);
    setEditRow(null);
    refresh();
  };

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">Memuat data…</p>;
  }

  if (error) {
    return <p className="p-4 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="p-4">
      {/* Toolbar atas */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-zinc-500">{rows.length} record</div>
        <button
          type="button"
          onClick={() => {
            setEditRow(null);
            setFormOpen("create");
          }}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Tambah Koreksi
        </button>
      </div>

      <KoreksiTable
        rows={rows}
        onPrint={handlePrint}
        onUpload={handleUpload}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Form dialog (tambah/edit) */}
      <KoreksiFormDialog
        open={formOpen}
        initial={editRow}
        onClose={() => setFormOpen(null)}
        onSaved={handleSaved}
        onPrint={handlePrint}
      />

      {/* Lembar cetak (REQ-03). window.print() membuka print dialog OS. */}
      {printRow && (
        <EkspedisiPrintSheet row={printRow} onClose={() => setPrintRow(null)} />
      )}
    </div>
  );
}
