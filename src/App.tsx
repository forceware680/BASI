import { useEffect, useState, useRef, useCallback } from "react";
import { KoreksiListPage } from "./pages/KoreksiListPage";
import logoKotaMagelang from "./assets/logo-kota-magelang.png";
import {
  FileSpreadsheet,
  Archive,
  Terminal,
  Moon,
  Sun,
  Cloud,
  CloudOff,
  HardDrive,
  Users,
  KeyRound,
  LogOut,
  ChevronDown,
  Shield,
  User,
  Loader2,
} from "lucide-react";
import { BackupRestoreDialog } from "./components/BackupRestoreDialog";
import { EksporLaporanDialog } from "./components/EksporLaporanDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { UserManagementDialog } from "./components/UserManagementDialog";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import { UpdateDialog } from "./components/UpdateDialog";
import { LoginScreen } from "./components/LoginScreen";
import { RekapitulasiPrintSheet } from "./components/print/RekapitulasiPrintSheet";
import { CloudOfflineModal } from "./components/CloudOfflineModal";
import type { KoreksiRow } from "./lib/types";
import { getDbInfo, toggleConsole, pingDb, getAppConfig, saveAppConfig } from "./lib/api";
import type { DbInfo } from "./lib/api";
import { useTheme } from "./lib/theme";
import { AuthProvider, useAuth } from "./lib/auth";
import { check } from "@tauri-apps/plugin-updater";
import { Sparkles } from "lucide-react";

// Koneksi default PostgreSQL lokal (Mode Offline) — dipakai saat beralih dari cloud.
const LOCAL_DB_URL = "postgresql://postgres:postgres@localhost:5432/sim_ba_koreksi";

function MainApp() {
  const { user, isAdmin, isLoading, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [backupOpen, setBackupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [hasUpdateBadge, setHasUpdateBadge] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Periksa pembaruan di background saat aplikasi dibuka
  useEffect(() => {
    check()
      .then((update) => {
        if (update && update.available) {
          setHasUpdateBadge(true);
        }
      })
      .catch(() => {});
  }, []);

  const [consoleVisible, setConsoleVisible] = useState(false);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [reportPrint, setReportPrint] = useState<{
    rows: KoreksiRow[];
    dateFrom: string;
    dateTo: string;
    statusLabel: string;
    opdLabel: string;
  } | null>(null);

  // Trigger reload data saat restore berhasil atau koneksi diubah
  const [refreshKey, setRefreshKey] = useState(0);
  const [allRows, setAllRows] = useState<KoreksiRow[]>([]);

  // Muat status mode database saat startup (termasuk saat belum login, agar
  // deteksi cloud-offline bisa berjalan sebelum autentikasi).
  useEffect(() => {
    getDbInfo().then(setDbInfo).catch(console.error);
  }, [refreshKey, user]);

  // Klik di luar dropdown profil untuk menutup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Pemantauan server cloud (hanya saat Mode Online) ---
  const isOnlineMode = dbInfo?.mode.includes("Online") ?? false;
  const [cloudDown, setCloudDown] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  const checkCloud = useCallback(async () => {
    try {
      const ok = await pingDb();
      setCloudDown(!ok);
      // Reset penolakan agar pemberitahuan muncul lagi bila cloud offline di kemudian hari.
      if (ok) setBannerDismissed(false);
    } catch {
      setCloudDown(true);
    }
  }, []);

  useEffect(() => {
    if (!isOnlineMode) {
      setCloudDown(false);
      return;
    }
    checkCloud();
    const id = setInterval(checkCloud, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkCloud();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkCloud);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkCloud);
    };
  }, [isOnlineMode, checkCloud]);

  const handleSwitchToOffline = async () => {
    setSwitchingMode(true);
    try {
      const cfg = await getAppConfig();
      await saveAppConfig({
        ...cfg,
        mode: "offline",
        database_url: LOCAL_DB_URL,
      });
      setCloudDown(false);
      setBannerDismissed(false);
      setRefreshKey((prev) => prev + 1);
      // Beralih server berarti berpindah basis data; reset sesi agar pengguna
      // melakukan login ulang terhadap server lokal (jika sebelumnya sudah login).
      if (user) logout();
    } catch (err) {
      alert(typeof err === "string" ? err : "Gagal beralih ke server lokal (offline).");
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleToggleConsole = async () => {
    const next = !consoleVisible;
    try {
      await toggleConsole(next);
      setConsoleVisible(next);
    } catch {
      // Abaikan jika non-windows
    }
  };

  // Tampilkan popup tawaran beralih ke server lokal (offline) saat cloud offline.
  const showCloudModal = isOnlineMode && cloudDown && !bannerDismissed;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
        <div className="text-center space-y-1">
          <div className="text-sm font-bold tracking-wider uppercase">SIMBASI BMD</div>
          <div className="text-xs text-slate-400">Memeriksa status sesi pengguna…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Popup tawaran beralih ke server lokal (offline) saat cloud offline.
          Ditaruh di sini agar tetap muncul bahkan saat belum login. */}
      <CloudOfflineModal
        open={showCloudModal}
        switching={switchingMode}
        onSwitch={handleSwitchToOffline}
        onRetry={checkCloud}
        onClose={() => setBannerDismissed(true)}
      />

      {!user ? (
        <LoginScreen />
      ) : (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200 antialiased">
      {/* Header Resmi Pemerintah Kota Magelang */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 sm:px-8 py-2.5 sm:py-3 shadow-sm transition-colors">
        <div className="mx-auto flex max-w-[1700px] w-full items-center justify-between gap-3">
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden lg:inline">Ekspor Laporan</span>
            </button>

            {/* Tombol Backup & Restore */}
            <button
              type="button"
              onClick={() => setBackupOpen(true)}
              title="Cadangan & Pemulihan Data"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <Archive className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden lg:inline">Cadangan Data</span>
            </button>

            {/* Tombol Toggle Tema Dark / Light Mode */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? "Ganti ke Tema Terang (Light Mode)" : "Ganti ke Tema Gelap (Dark Mode)"}
              className="inline-flex items-center justify-center h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
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
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 text-xs font-semibold transition-colors shadow-sm shrink-0 cursor-pointer ${
                consoleVisible
                  ? "border-slate-800 bg-slate-900 text-white dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Terminal className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">CMD</span>
            </button>

            {/* Status Mode Database (Offline / Online) & Tombol Pengaturan */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title={
                dbInfo
                  ? `Mode: ${dbInfo.mode}\nHost: ${dbInfo.host}:${dbInfo.port}\nDatabase: ${dbInfo.database}\n(Klik untuk mengubah pengaturan mode koneksi & database)`
                  : "Memeriksa status koneksi database..."
              }
              className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 px-2.5 sm:px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer select-none transition-all shrink-0"
            >
              {dbInfo?.mode.includes("Online") && cloudDown ? (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-700 dark:text-amber-300 hidden xl:inline">
                    Cloud Offline
                  </span>
                  <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)] shrink-0" />
                </>
              ) : dbInfo?.mode.includes("Online") ? (
                <>
                  <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200 hidden xl:inline">
                    {dbInfo?.mode || "Database"}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] shrink-0" />
                </>
              ) : (
                <>
                  <HardDrive className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200 hidden xl:inline">
                    {dbInfo?.mode || "Database"}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)] shrink-0" />
                </>
              )}
            </button>

            {/* Profil Pengguna & Menu RBAC Dropdown */}
            <div className="relative shrink-0" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="relative flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all cursor-pointer"
              >
                <div className="relative">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  {hasUpdateBadge && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-800 animate-pulse" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight max-w-[120px] truncate">
                    {user.full_name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    {isAdmin ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Admin</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Operator</span>
                    )}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Header */}
                  <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {user.full_name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      @{user.username}
                    </div>
                    <div className="mt-1.5">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                          <Shield className="h-2.5 w-2.5" />
                          Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          <User className="h-2.5 w-2.5" />
                          Operator
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-0.5 text-xs">
                    {/* Pembaruan Sistem (Auto Updater) */}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setUpdateOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span>Pembaruan Sistem</span>
                      </div>
                      {hasUpdateBadge && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wider">
                          Baru
                        </span>
                      )}
                    </button>

                    {/* Manajemen Pengguna (Khusus Admin) */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setUserManagementOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors text-left cursor-pointer"
                      >
                        <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        Manajemen Pengguna
                      </button>
                    )}

                    {/* Ubah Password (Semua User) */}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setChangePasswordOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
                    >
                      <KeyRound className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      Ubah Kata Sandi
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                    {/* Logout */}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-medium transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      Keluar (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 px-4 sm:px-8 py-6 mx-auto w-full max-w-[1700px]">
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

      {/* Modal Pengaturan Koneksi Database & File API */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setRefreshKey((prev) => prev + 1);
        }}
      />

      {/* Modal Manajemen Pengguna (Khusus Admin) */}
      <UserManagementDialog
        open={userManagementOpen}
        onClose={() => setUserManagementOpen(false)}
      />

      {/* Modal Ubah Kata Sandi */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />

      {/* Modal Pembaruan Sistem (Auto Updater) */}
      <UpdateDialog
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
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
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
