// components/UploadSourceDialog.tsx — Modal Pilihan Sumber Unggah Bukti dengan Tahap Staging & Pratinjau (Preview).

import { useEffect, useState } from "react";
import type { KoreksiRow } from "../lib/types";
import { listScanners, pickToStaging, scanToStaging } from "../lib/api";
import type { ScannerDeviceInfo, ScanOptions, StagedFile } from "../lib/api";
import {
  FolderOpen,
  Printer,
  X,
  Loader2,
  FileCheck2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  RefreshCw,
  Eye,
  FileText,
} from "lucide-react";

export function UploadSourceDialog({
  open,
  row,
  onClose,
  onCommitSuccess,
}: {
  open: boolean;
  row: KoreksiRow | null;
  onClose: () => void;
  onCommitSuccess: (row: KoreksiRow, staged: StagedFile) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"choose" | "scannerConfig" | "preview">("choose");

  // Scanner settings state
  const [scanners, setScanners] = useState<ScannerDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [source, setSource] = useState<"ADF" | "Flatbed">("ADF");
  const [dpi, setDpi] = useState<number>(300);
  const [pageSize, setPageSize] = useState<"A4" | "F4">("A4");
  const [colorMode, setColorMode] = useState<"Color" | "Grayscale" | "BW">("Color");
  const [fetchingDevices, setFetchingDevices] = useState(false);

  // Staging & Preview State
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [zoom, setZoom] = useState(1);

  // Ambil daftar scanner saat dialog dibuka
  useEffect(() => {
    if (!open) {
      setTab("choose");
      setStagedFile(null);
      setError(null);
      setZoom(1);
      return;
    }
    setFetchingDevices(true);
    listScanners()
      .then((list) => {
        setScanners(list);
        if (list.length > 0) {
          setSelectedDeviceId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setFetchingDevices(false));
  }, [open]);

  // Shortcut Escape untuk tutup / kembali
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        e.stopPropagation();
        if (tab === "preview") {
          setTab("choose");
          setStagedFile(null);
        } else if (tab === "scannerConfig") {
          setTab("choose");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, loading, tab, onClose]);

  if (!open || !row) return null;

  // 1. Pilih dari Explorer -> Masuk Staging Preview
  const handleSelectExplorer = async () => {
    setError(null);
    setLoading(true);
    setLoadingMsg("Membuka pemilih file komputer...");
    try {
      const staged = await pickToStaging();
      if (staged) {
        setStagedFile(staged);
        setZoom(1);
        setTab("preview");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // 2. Eksekusi Scan dari Scanner -> Masuk Staging Preview
  const handleStartScan = async () => {
    setError(null);
    setLoading(true);
    setLoadingMsg(`Sedang memindai dari ${source === "ADF" ? "Tray ADF (Feeder)" : "Kaca Flatbed"} (${dpi} DPI)...`);
    try {
      const options: ScanOptions = {
        device_id: selectedDeviceId || undefined,
        source,
        dpi,
        page_size: pageSize,
        color_mode: colorMode,
      };
      const staged = await scanToStaging(options);
      if (staged) {
        setStagedFile(staged);
        setZoom(1);
        setTab("preview");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // 3. Konfirmasi Penggunaan Berkas Staging -> Simpan Permanen ke Database
  const handleConfirmCommit = async () => {
    if (!stagedFile) return;
    setLoading(true);
    setLoadingMsg("Menyimpan berkas bukti scan ke database...");
    try {
      await onCommitSuccess(row, stagedFile);
      onClose();
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className={`w-full ${tab === "preview" ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-all`}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm ${
              tab === "preview"
                ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60"
                : "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/60"
            }`}>
              {tab === "preview" ? <Eye className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {tab === "preview"
                  ? "Pratinjau Hasil Pindaian (Staging)"
                  : tab === "scannerConfig"
                  ? "Pengaturan Pemindaian Scanner"
                  : "Unggah Bukti Scan BA Koreksi"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tab === "preview"
                  ? "Periksa ketajaman dan posisi naskah sebelum disimpan ke database"
                  : tab === "scannerConfig"
                  ? "Atur sumber kertas ADF/Flatbed, resolusi DPI, & ukuran kertas"
                  : "Pilih sumber dokumen bukti tanda terima fisik"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Informasi Berkas Target */}
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400">No. BA Koreksi:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{row.no_ba}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400">OPD Pengusul:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px] sm:max-w-[420px]">{row.nama_opd}</span>
          </div>
        </div>

        {/* Notifikasi Loading / Error */}
        {loading && (
          <div className="mb-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/50 p-4 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
            <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              {loadingMsg || "Sedang memproses..."}
            </p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
              Mohon tunggu hingga proses pemindaian / pemindahan berkas selesai
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: Pilihan Sumber Berkas */}
        {tab === "choose" && !loading && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {/* Opsi 1: File Explorer */}
            <button
              type="button"
              onClick={handleSelectExplorer}
              className="group flex flex-col text-left rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 transition-all hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 hover:shadow-md cursor-pointer"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 group-hover:scale-105 transition-transform mb-3">
                <FolderOpen className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Pilih dari File Explorer
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Pilih dokumen digital dari komputer (PDF, JPG, PNG hingga 150 MB).
              </span>
            </button>

            {/* Opsi 2: Scanner Langsung */}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setTab("scannerConfig");
              }}
              className="group flex flex-col text-left rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 transition-all hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 hover:shadow-md cursor-pointer"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 group-hover:scale-105 transition-transform mb-3">
                <Printer className="h-5 w-5" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Pindai dari Scanner
                </span>
                <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  ADF / 300 DPI
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Pindai otomatis dari tray ADF (Feeder) atau Flatbed dengan pratinjau staging.
              </span>
            </button>
          </div>
        )}

        {/* TAB 2: Konfigurasi Parameter Scanner */}
        {tab === "scannerConfig" && !loading && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Pilihan Perangkat Scanner */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Perangkat Scanner
              </label>
              {fetchingDevices ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 p-2">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Mendeteksi scanner di jaringan LAN / USB...</span>
                </div>
              ) : scanners.length > 0 ? (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                >
                  {scanners.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                  Scanner spesifik tidak terdaftar langsung, sistem akan memanggil dialog pemilihan scanner otomatis.
                </div>
              )}
            </div>

            {/* Grid Parameter: Sumber Kertas, Resolusi, Ukuran, Warna */}
            <div className="grid grid-cols-2 gap-3">
              {/* Sumber Kertas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sumber Kertas
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSource("ADF")}
                    className={`rounded-lg py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                      source === "ADF"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    ADF (Feeder)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource("Flatbed")}
                    className={`rounded-lg py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                      source === "Flatbed"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    Flatbed (Kaca)
                  </button>
                </div>
              </div>

              {/* Resolusi DPI */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Resolusi Pemindaian
                </label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                >
                  <option value={150}>150 x 150 DPI (Cepat)</option>
                  <option value={300}>300 x 300 DPI (Standar Berkas)</option>
                  <option value={600}>600 x 600 DPI (Tinggi)</option>
                  <option value={1200}>1200 x 1200 DPI (Optik Maksimal)</option>
                </select>
              </div>

              {/* Ukuran Kertas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ukuran Dokumen
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as "A4" | "F4")}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                >
                  <option value="A4">A4 (210 x 297 mm)</option>
                  <option value="F4">F4 / Folio (215 x 330 mm)</option>
                </select>
              </div>

              {/* Mode Warna */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mode Warna
                </label>
                <select
                  value={colorMode}
                  onChange={(e) => setColorMode(e.target.value as "Color" | "Grayscale" | "BW")}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                >
                  <option value="Color">Berwarna (Color)</option>
                  <option value="Grayscale">Abu-abu (Grayscale)</option>
                  <option value="BW">Hitam Putih (B&W)</option>
                </select>
              </div>
            </div>

            {/* Info Kapasitas & Pratinjau */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
              <span className="font-bold">✓ Staging Preview Otomatis:</span> Setelah pindaian selesai, hasil scan akan ditampilkan di layar pratinjau terlebih dahulu. Berkas baru akan disimpan ke database setelah Anda menyetujuinya.
            </div>

            {/* Tombol Aksi Eksekusi Scan */}
            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setTab("choose")}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleStartScan}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Mulai Pindai ({source} • {dpi} DPI • {pageSize})</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Pratinjau Berkas Staging (Preview Sebelum Simpan) */}
        {tab === "preview" && stagedFile && !loading && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Toolbar Pratinjau & Zoom */}
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 truncate max-w-[280px]">
                <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-semibold truncate">{stagedFile.file_name}</span>
                <span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  {formatBytes(stagedFile.file_size)}
                </span>
              </div>
              {/* Zoom Buttons (Hanya untuk gambar) */}
              {!stagedFile.file_type.includes("pdf") && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    title="Perkecil"
                    className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-[11px] w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    title="Perbesar"
                    className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    title="Reset Zoom"
                    className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Container Preview Gambar / PDF */}
            <div className="relative flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-2 overflow-auto max-h-[380px] min-h-[260px]">
              {stagedFile.file_type.includes("pdf") ? (
                <iframe
                  src={stagedFile.data_url}
                  title="Pratinjau PDF"
                  className="h-[360px] w-full rounded-lg bg-white"
                />
              ) : (
                <img
                  src={stagedFile.data_url}
                  alt="Pratinjau Hasil Pindaian"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                  className="max-h-[360px] w-auto max-w-full object-contain rounded-md shadow-md transition-transform duration-150"
                />
              )}
            </div>

            {/* Tombol Aksi Konfirmasi */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setStagedFile(null);
                  setTab("scannerConfig");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Pindai Ulang / Ubah File</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCommit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Gunakan & Simpan Berkas Ini</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {tab === "choose" && !loading && (
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs text-slate-400">
            <span>Tekan <kbd className="font-mono text-[11px] rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700">Esc</kbd> untuk batal</span>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

