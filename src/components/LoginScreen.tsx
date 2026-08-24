// components/LoginScreen.tsx — Layar Autentikasi Masuk SIMBASI BMD.
// Dibuat dengan standar desain Impeccable: Tonal Elevation, WCAG AAA Contrast, dan Motion Halus.

import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import logoKotaMagelang from "../assets/logo-kota-magelang.png";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Moon,
  Sun,
  KeyRound,
} from "lucide-react";

export function LoginScreen() {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Silakan masukkan nama pengguna dan kata sandi.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(typeof err === "string" ? err : "Gagal masuk. Periksa kembali nama pengguna dan kata sandi Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Ambient Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <img
            src={logoKotaMagelang}
            alt="Logo Kota Magelang"
            className="h-9 w-auto object-contain drop-shadow-sm"
          />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Pemerintah Kota Magelang
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Badan Pengelolaan Keuangan dan Aset Daerah
            </div>
          </div>
        </div>

        {/* Toggle Dark / Light Mode */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? "Ganti ke Tema Terang (Light Mode)" : "Ganti ke Tema Gelap (Dark Mode)"}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-90 duration-300" />
          ) : (
            <Moon className="h-4 w-4 text-slate-600 animate-in spin-in-90 duration-300" />
          )}
        </button>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-6 sm:p-8 shadow-2xl transition-all">
          {/* Card Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 shadow-sm mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              SIMBASI BMD
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              Sistem Informasi Pelacakan & Sirkulasi Berita Acara Koreksi Barang Milik Daerah
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in duration-150">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Nama Pengguna (Username)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoFocus
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/70 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all disabled:opacity-50"
              />
            </div>

            {/* Input Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/70 px-3.5 py-2.5 pr-10 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memverifikasi Akun…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Masuk ke Sistem
                </>
              )}
            </button>
          </form>

          {/* Footer Info Box */}
          <div className="mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sistem Aktif & Terlindungi
            </span>
            <span className="font-mono text-[10px] text-slate-400">v1.2.1</span>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full text-center py-4 text-xs text-slate-500 dark:text-slate-400 z-10">
        &copy; {new Date().getFullYear()} Subid Penatausahaan Aset BPKAD Kota Magelang.
      </footer>
    </div>
  );
}
