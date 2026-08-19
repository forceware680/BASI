// pages/KoreksiListPage.tsx — halaman utama daftar koreksi BMD dengan dialog konfirmasi hapus dan hapus bukti.

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  listKoreksi,
  deleteKoreksi,
  pickAndUploadBukti,
  deleteBukti,
} from "../lib/api";
import type { KoreksiRow } from "../lib/types";
import { KoreksiTable } from "../components/KoreksiTable";
import { KoreksiFormDialog } from "../components/KoreksiFormDialog";
import { EkspedisiPrintSheet } from "../components/print/EkspedisiPrintSheet";
import { BuktiViewerDialog } from "../components/BuktiViewerDialog";
import { ConfirmDeleteDialog } from "../components/ConfirmDeleteDialog";
import {
  Plus,
  RotateCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Inbox,
} from "lucide-react";

export function KoreksiListPage({
  onRowsLoaded,
}: {
  onRowsLoaded?: (rows: KoreksiRow[]) => void;
}) {
  const [rows, setRows] = useState<KoreksiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; success: boolean } | null>(null);

  // Modals state
  const [formOpen, setFormOpen] = useState<"create" | "edit" | null>(null);
  const [editRow, setEditRow] = useState<KoreksiRow | null>(null);
  const [printRow, setPrintRow] = useState<KoreksiRow | null>(null);
  const [viewRow, setViewRow] = useState<KoreksiRow | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Modal Konfirmasi Hapus
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    target: KoreksiRow | null;
    mode: "record" | "bukti";
    loading: boolean;
  }>({
    open: false,
    target: null,
    mode: "record",
    loading: false,
  });

  const showToast = (message: string, success = true) => {
    setToast({ message, success });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listKoreksi();
      setRows(data);
      onRowsLoaded?.(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [onRowsLoaded]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(() => {
    return listKoreksi()
      .then((r) => {
        setRows(r);
        onRowsLoaded?.(r);
      })
      .catch((e) => setError(String(e)));
  }, [onRowsLoaded]);

  // Statistik Ringkasan (KPI)
  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === "MENUNGGU_BUKTI").length;
    const completed = rows.filter((r) => r.status === "SELESAI").length;
    return { total, pending, completed };
  }, [rows]);

  const handlePrint = (row: KoreksiRow) => setPrintRow(row);

  // Upload bukti dengan native file picker Rust
  const handleUpload = async (row: KoreksiRow) => {
    setUploading(row.id);
    try {
      const updated = await pickAndUploadBukti(row.id);
      if (updated) {
        setRows((prev: KoreksiRow[]) => {
          const next = prev.map((r: KoreksiRow) => (r.id === updated.id ? updated : r));
          onRowsLoaded?.(next);
          return next;
        });
        showToast(`Bukti ${row.no_ba} berhasil diunggah. Status berkas menjadi SELESAI.`);
      }
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setUploading(null);
    }
  };

  const handleView = (row: KoreksiRow) => setViewRow(row);

  // Buka Modal Konfirmasi Hapus Data Record
  const handleDelete = (row: KoreksiRow) => {
    setDeleteModal({
      open: true,
      target: row,
      mode: "record",
      loading: false,
    });
  };

  // Buka Modal Konfirmasi Hapus Bukti Scan
  const handleDeleteBukti = (row: KoreksiRow) => {
    setDeleteModal({
      open: true,
      target: row,
      mode: "bukti",
      loading: false,
    });
  };

  // Eksekusi Konfirmasi Hapus (Record atau Bukti)
  const handleConfirmDelete = async () => {
    const { target, mode } = deleteModal;
    if (!target) return;

    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      if (mode === "record") {
        await deleteKoreksi(target.id);
        showToast(`Data koreksi BA "${target.no_ba}" berhasil dihapus permanen.`);
        setDeleteModal({ open: false, target: null, mode: "record", loading: false });
        if (viewRow?.id === target.id) setViewRow(null);
        refresh();
      } else {
        const updated = await deleteBukti(target.id);
        setRows((prev: KoreksiRow[]) => {
          const next = prev.map((r: KoreksiRow) => (r.id === updated.id ? updated : r));
          onRowsLoaded?.(next);
          return next;
        });
        showToast(`Bukti scan "${target.no_ba}" berhasil dihapus. Status kembali MENUNGGU BUKTI.`);
        setDeleteModal({ open: false, target: null, mode: "record", loading: false });
        setViewRow(null); // Tutup viewer
      }
    } catch (e) {
      showToast(String(e), false);
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleEdit = (row: KoreksiRow) => {
    setEditRow(row);
    setFormOpen("edit");
  };

  const handleSaved = () => {
    setFormOpen(null);
    setEditRow(null);
    refresh();
    showToast("Data koreksi berhasil disimpan.");
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium">Memuat data Berita Acara Koreksi…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-2" />
        <h3 className="text-sm font-bold text-red-900">Gagal Mengakses Data</h3>
        <p className="mt-1 text-xs text-red-700">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-red-700"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-xl transition-all animate-in slide-in-from-bottom-5 ${
            toast.success
              ? "border border-emerald-200 bg-emerald-600 text-white"
              : "border border-red-200 bg-red-600 text-white"
          }`}
        >
          {toast.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Halaman & Tombol Aksi Cepat */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Pelacakan Ekspedisi BA Koreksi BMD
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sirkulasi Berita Acara Koreksi Barang Milik Daerah Kota Magelang
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400"
            title="Muat ulang data"
          >
            <RotateCw className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditRow(null);
              setFormOpen("create");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Koreksi Baru</span>
          </button>
        </div>
      </div>

      {/* Dashboard KPI Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Total */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-900/60 dark:to-slate-900 p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Berkas Koreksi
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          </div>
        </div>

        {/* Card 2: Menunggu Bukti */}
        <div className="flex items-center gap-4 rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-950/20 dark:to-slate-900 p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/90">
              Menunggu Bukti Fisik
            </div>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-300">{stats.pending}</div>
          </div>
        </div>

        {/* Card 3: Selesai */}
        <div className="flex items-center gap-4 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-950/20 dark:to-slate-900 p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-400/90">
              Selesai & Diarsipkan
            </div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* Tabel Utama */}
      <KoreksiTable
        rows={rows}
        uploadingId={uploading}
        onPrint={handlePrint}
        onUpload={handleUpload}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddNew={() => {
          setEditRow(null);
          setFormOpen("create");
        }}
      />

      {/* Dialog Form Tambah / Edit */}
      <KoreksiFormDialog
        open={formOpen}
        initial={editRow}
        onClose={() => setFormOpen(null)}
        onSaved={handleSaved}
        onPrint={handlePrint}
      />

      {/* Preview & Print Ekspedisi Tunggal */}
      {printRow && (
        <EkspedisiPrintSheet row={printRow} onClose={() => setPrintRow(null)} />
      )}

      {/* Viewer Dokumen Bukti Scan */}
      <BuktiViewerDialog
        row={viewRow}
        onClose={() => setViewRow(null)}
        onDeleteBukti={handleDeleteBukti}
      />

      {/* Modal Konfirmasi Hapus Data / Bukti */}
      <ConfirmDeleteDialog
        open={deleteModal.open}
        target={deleteModal.target}
        mode={deleteModal.mode}
        loading={deleteModal.loading}
        onClose={() => setDeleteModal({ open: false, target: null, mode: "record", loading: false })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
