// App.tsx — Layout Utama SIM-BA Koreksi BMD dengan Logo Pemkot Magelang.

import { useState } from "react";
import { KoreksiListPage } from "./pages/KoreksiListPage";
import logoKotaMagelang from "./assets/logo-kota-magelang.png";
import { Database, FileSpreadsheet, Archive } from "lucide-react";
import { BackupRestoreDialog } from "./components/BackupRestoreDialog";
import { EksporLaporanDialog } from "./components/EksporLaporanDialog";
import { RekapitulasiPrintSheet } from "./components/print/RekapitulasiPrintSheet";
import type { KoreksiRow } from "./lib/types";

export default function App() {
  const [backupOpen, setBackupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      {/* Header Resmi Pemerintah Kota Magelang */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={logoKotaMagelang}
              alt="Logo Kota Magelang"
              className="h-11 w-auto object-contain drop-shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">
                  SIMBASI BMD
                </h1>
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                  Kota Magelang
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Kasubid Penatausahaan Aset — Badan Pengelolaan Keuangan dan Aset Daerah
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tombol Ekspor Laporan */}
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-indigo-600 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
              Ekspor Laporan
            </button>

            {/* Tombol Backup & Restore */}
            <button
              type="button"
              onClick={() => setBackupOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-indigo-600 transition-colors"
            >
              <Archive className="h-4 w-4 text-indigo-600" />
              Cadangan Data
            </button>

            {/* Status Database */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-600">
              <Database className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-medium text-slate-700">PostgreSQL</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
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

      {/* Modal Backup & Restore */}
      <BackupRestoreDialog
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onRestored={() => setRefreshKey((k) => k + 1)}
      />

      {/* Lembar Cetak Rekapitulasi Laporan */}
      {reportPrint && (
        <RekapitulasiPrintSheet
          rows={reportPrint.rows}
          dateFrom={reportPrint.dateFrom}
          dateTo={reportPrint.dateTo}
          statusLabel={reportPrint.statusLabel}
          opdLabel={reportPrint.opdLabel}
          onClose={() => setReportPrint(null)}
        />
      )}
    </div>
  );
}
