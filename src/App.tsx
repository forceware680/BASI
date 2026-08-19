// App.tsx — Layout Utama SIMBASI BMD dengan Theme Dark Mode, Logo Pemkot Magelang, status PostgreSQL (Portable / Standalone), dan toggle konsol debug.

import { useEffect, useState } from "react";
import { KoreksiListPage } from "./pages/KoreksiListPage";
import logoKotaMagelang from "./assets/logo-kota-magelang.png";
import { Database, FileSpreadsheet, Archive, Terminal, Moon, Sun } from "lucide-react";
import { BackupRestoreDialog } from "./components/BackupRestoreDialog";
import { EksporLaporanDialog } from "./components/EksporLaporanDialog";
import { RekapitulasiPrintSheet } from "./components/print/RekapitulasiPrintSheet";
import type { KoreksiRow } from "./lib/types";
import { getDbInfo, toggleConsole } from "./lib/api";
import type { DbInfo } from "./lib/api";
import { useTheme } from "./lib/theme";

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const [backupOpen, setBackupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [reportPrint, setReportPrint] = useState<{
    rows: KoreksiRow[];
    dateFrom: string;
    dateTo: string;
    statusLabel: string;
    opdLabel: string;
  } | null>(null);

  // Trigger reload data saat restore berhasil
  const [refreshKey, setRefreshKey] = useState(0);
  const [allRows, setAllRows] = useState<KoreksiRow[]>([]);

  // Muat status mode database saat aplikasi startup
  useEffect(() => {
    getDbInfo().then(setDbInfo).catch(console.error);
  }, []);

  const handleToggleConsole = async () => {
    const next = !consoleVisible;
    try {
      await toggleConsole(next);
      setConsoleVisible(next);
    } catch {
      // Abaikan jika non-windows
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200 antialiased">
      {/* Header Resmi Pemerintah Kota Magelang */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 sm:px-6 py-2.5 sm:py-3 shadow-sm transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <img
              src={logoKotaMagelang}
              alt="Logo Kota Magelang"
              className="h-8 sm:h-10 w-auto object-contain drop-shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  SIMBASI BMD
                </h1>
                <span className="hidden sm:inline-block rounded bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 uppercase tracking-wider shrink-0">
                  Kota Magelang
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate hidden xl:block">
                Kasubid Penatausahaan Aset — Badan Pengelolaan Keuangan dan Aset Daerah
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Tombol Ekspor Laporan */}
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              title="Ekspor Laporan & Rekapitulasi"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden lg:inline">Ekspor Laporan</span>
            </button>

            {/* Tombol Backup & Restore */}
            <button
              type="button"
              onClick={() => setBackupOpen(true)}
              title="Cadangan & Pemulihan Data"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Archive className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden lg:inline">Cadangan Data</span>
            </button>

            {/* Tombol Toggle Tema Dark / Light Mode */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? "Ganti ke Tema Terang (Light Mode)" : "Ganti ke Tema Gelap (Dark Mode)"}
              className="inline-flex items-center justify-center h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-90" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600 animate-in spin-in-90" />
              )}
            </button>

            {/* Tombol Toggle Konsol CMD */}
            <button
              type="button"
              onClick={handleToggleConsole}
              title={consoleVisible ? "Sembunyikan Jendela CMD" : "Tampilkan Jendela CMD untuk debug"}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 text-xs font-semibold transition-colors shadow-sm shrink-0 ${
                consoleVisible
                  ? "border-slate-800 bg-slate-900 text-white dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Terminal className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">CMD</span>
            </button>

            {/* Status Mode Database (Portable / Standalone) */}
            <div
              title={
                dbInfo
                  ? `Tersambung ke PostgreSQL (${dbInfo.mode}) pada ${dbInfo.host}:${dbInfo.port}/${dbInfo.database}`
                  : "Memeriksa status koneksi database..."
              }
              className="hidden md:flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 px-2.5 sm:px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 shadow-sm cursor-default select-none transition-colors shrink-0"
            >
              <Database className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-200 hidden xl:inline">
                PostgreSQL
              </span>
              {dbInfo && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    dbInfo.mode === "Portable"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80"
                      : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80"
                  }`}
                >
                  {dbInfo.mode}
                </span>
              )}
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] shrink-0" />
            </div>
          </div>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 px-6 py-6 mx-auto w-full max-w-7xl">
        <KoreksiListPage
          key={refreshKey}
          onRowsLoaded={setAllRows}
        />
      </main>

      {/* Modal Ekspor Laporan */}
      <EksporLaporanDialog
        open={exportOpen}
        allRows={allRows}
        onClose={() => setExportOpen(false)}
        onPrintReport={(filtered, dateFrom, dateTo, statusLabel, opdLabel) => {
          setExportOpen(false);
          setReportPrint({
            rows: filtered,
            dateFrom,
            dateTo,
            statusLabel,
            opdLabel,
          });
        }}
      />

      {/* Modal Cadangan Data */}
      <BackupRestoreDialog
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onRestored={() => {
          setBackupOpen(false);
          setRefreshKey((prev) => prev + 1);
        }}
      />

      {/* Lembar Cetak Rekapitulasi Laporan (Tampil Hanya Saat Dicetak) */}
      {reportPrint && (
        <RekapitulasiPrintSheet
          rows={reportPrint.rows}
          dateFrom={reportPrint.dateFrom}
          dateTo={reportPrint.dateTo}
          statusLabel={reportPrint.statusLabel}
          opdLabel={reportPrint.opdLabel}
          onClose={() => setReportPrint(null)}
          onAfterPrint={() => setReportPrint(null)}
        />
      )}
    </div>
  );
}
