// SettingsDialog.tsx — Pengaturan Koneksi Database (Offline vs Online) & File API Service.
// Desain Dark Mode & Light Mode berstandar WCAG AAA dengan Tonal Elevation & Atmospheric UI.

import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import {
  ShieldAlert,
  Server,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Key,
  Database,
  Radio,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import {
  getAppConfig,
  saveAppConfig,
  testDbConnection,
  testStorageApiConnection,
} from "../lib/api";
import type { AppConfig } from "../lib/api";

const PRESET_LOCAL_DB = "postgresql://postgres:postgres@localhost:5432/sim_ba_koreksi";
const PRESET_ONLINE_DB =
  "postgres://postgres:XSRMfNGXXAd7aRvTyanmMGbcRLIVDmxB4nf5CwFEU4g5j7VYKTvVxEWMcvRsT8bH@45.198.155.126:27492/sim_ba_koreksi";
const PRESET_ONLINE_STORAGE = "http://simbasi.bpkad.web.id";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SettingsDialog({ open, onClose, onSaved }: SettingsDialogProps) {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<AppConfig>({
    mode: "offline",
    database_url: PRESET_LOCAL_DB,
    storage_api_url: "",
    storage_api_key: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Status Tes Koneksi Database
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Status Tes Koneksi Storage API
  const [testingStorage, setTestingStorage] = useState(false);
  const [storageTestResult, setStorageTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setErrorMsg(null);
      setDbTestResult(null);
      setStorageTestResult(null);

      getAppConfig()
        .then((cfg) => {
          setConfig(cfg);
        })
        .catch((err) => {
          setErrorMsg(typeof err === "string" ? err : "Gagal memuat konfigurasi.");
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const handleModeChange = (newMode: "offline" | "online") => {
    if (newMode === "offline") {
      setConfig((prev) => ({
        ...prev,
        mode: "offline",
        database_url: prev.database_url.includes("45.198") ? PRESET_LOCAL_DB : prev.database_url,
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        mode: "online",
        database_url: prev.database_url.includes("localhost") ? PRESET_ONLINE_DB : prev.database_url,
        storage_api_url: prev.storage_api_url || PRESET_ONLINE_STORAGE,
      }));
    }
    setDbTestResult(null);
    setStorageTestResult(null);
  };

  const handleTestDb = async () => {
    if (!config.database_url.trim()) {
      setDbTestResult({ success: false, message: "URL Database tidak boleh kosong." });
      return;
    }
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await testDbConnection(config.database_url.trim());
      setDbTestResult({ success: true, message: res });
    } catch (err) {
      setDbTestResult({
        success: false,
        message: typeof err === "string" ? err : "Gagal terhubung ke database.",
      });
    } finally {
      setTestingDb(false);
    }
  };

  const handleTestStorage = async () => {
    if (!config.storage_api_url.trim()) {
      setStorageTestResult({ success: false, message: "URL Storage API tidak boleh kosong." });
      return;
    }
    setTestingStorage(true);
    setStorageTestResult(null);
    try {
      const res = await testStorageApiConnection(
        config.storage_api_url.trim(),
        config.storage_api_key.trim() || undefined
      );
      setStorageTestResult({ success: true, message: res });
    } catch (err) {
      setStorageTestResult({
        success: false,
        message: typeof err === "string" ? err : "Gagal terhubung ke File API Service.",
      });
    } finally {
      setTestingStorage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveAppConfig({
        ...config,
        database_url: config.database_url.trim(),
        storage_api_url: config.storage_api_url.trim(),
        storage_api_key: config.storage_api_key.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Pengaturan Mode & Koneksi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAdmin
                  ? "Pilih mode operasional dan kelola kredensial database / file API"
                  : "Beralih antara Mode Penyimpanan Lokal (Offline) atau Cloud (Online)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm font-medium">Memuat konfigurasi...</p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 shadow-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Informational Banner for Non-Admin */}
              {!isAdmin && (
                <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 text-xs flex items-start gap-2.5 shadow-sm">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="leading-relaxed">
                    Anda masuk sebagai <strong>User Biasa</strong>. Anda dapat beralih antara <strong>Mode Offline</strong> dan <strong>Mode Online</strong>. Kredensial server database dan storage key diamankan dan hanya dapat dikelola oleh Administrator.
                  </span>
                </div>
              )}

              {/* Mode Selection Cards */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pilih Mode Operasional
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Card Offline */}
                  <button
                    type="button"
                    onClick={() => handleModeChange("offline")}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all ${
                      config.mode === "offline"
                        ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500/20 dark:ring-indigo-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        config.mode === "offline"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60"
                      }`}
                    >
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Mode Offline (Lokal)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Data dan berkas scan disimpan di komputer ini (PostgreSQL Portabel / Standalone).
                      </p>
                    </div>
                  </button>

                  {/* Card Online */}
                  <button
                    type="button"
                    onClick={() => handleModeChange("online")}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all ${
                      config.mode === "online"
                        ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500/20 dark:ring-indigo-500/30"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        config.mode === "online"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60"
                      }`}
                    >
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Mode Online (Cloud)
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-[10px] font-bold">
                          Multi-User
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Terhubung ke Server Coolify VPS & File API Service bersama.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bagian Sensitif: Hanya Ditampilkan untuk Role ADMIN */}
              {isAdmin && (
                <>
                  {/* Database Connection URL */}
                  <div className="space-y-2 pt-4 border-t border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        URL PostgreSQL Connection String
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              database_url:
                                prev.mode === "online" ? PRESET_ONLINE_DB : PRESET_LOCAL_DB,
                            }))
                          }
                          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 transition-colors"
                          title="Gunakan template default"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Gunakan Template {config.mode === "online" ? "Cloud" : "Lokal"}
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type={showDbPassword ? "text" : "password"}
                        value={config.database_url}
                        onChange={(e) => {
                          setConfig((prev) => ({ ...prev, database_url: e.target.value }));
                          setDbTestResult(null);
                        }}
                        placeholder="postgres://user:password@host:port/database"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/70 px-3.5 py-2.5 pr-20 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowDbPassword(!showDbPassword)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                        >
                          {showDbPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleTestDb}
                          disabled={testingDb}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:border dark:border-slate-700 dark:hover:bg-indigo-600 dark:hover:border-indigo-500 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-all disabled:opacity-50 shadow-sm"
                        >
                          {testingDb ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radio className="h-3 w-3" />}
                          Tes
                        </button>
                      </div>
                    </div>

                    {dbTestResult && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm transition-all ${
                          dbTestResult.success
                            ? "bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200"
                            : "bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200"
                        }`}
                      >
                        {dbTestResult.success ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                        )}
                        <span className="break-all leading-relaxed">{dbTestResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Mode Online File API Configuration */}
                  {config.mode === "online" && (
                    <div className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-150">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <Server className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            URL File API Service (Penyimpanan Berkas Scan)
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({
                                ...prev,
                                storage_api_url: PRESET_ONLINE_STORAGE,
                              }))
                            }
                            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Preset Domain
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            value={config.storage_api_url}
                            onChange={(e) => {
                              setConfig((prev) => ({ ...prev, storage_api_url: e.target.value }));
                              setStorageTestResult(null);
                            }}
                            placeholder="http://simbasi.bpkad.web.id atau https://storage.domain.com"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/70 px-3.5 py-2.5 pr-20 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <button
                              type="button"
                              onClick={handleTestStorage}
                              disabled={testingStorage}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:border dark:border-slate-700 dark:hover:bg-indigo-600 dark:hover:border-indigo-500 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-all disabled:opacity-50 shadow-sm"
                            >
                              {testingStorage ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Radio className="h-3 w-3" />
                              )}
                              Tes
                            </button>
                          </div>
                        </div>

                        {storageTestResult && (
                          <div
                            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 shadow-sm transition-all ${
                              storageTestResult.success
                                ? "bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200"
                                : "bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200"
                            }`}
                          >
                            {storageTestResult.success ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                            )}
                            <span className="break-all leading-relaxed">{storageTestResult.message}</span>
                          </div>
                        )}
                      </div>

                      {/* API Key */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          API Key Secret (Opsional)
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={config.storage_api_key}
                            onChange={(e) =>
                              setConfig((prev) => ({ ...prev, storage_api_key: e.target.value }))
                            }
                            placeholder="Contoh: simbasi_secret_key_bpkad_magelang"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/70 px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                          >
                            {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-800/60 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan & Terapkan Koneksi
          </button>
        </div>
      </div>
    </div>
  );
}
