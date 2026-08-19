// components/OpdCombobox.tsx — master data OPD (REQ-01) dengan pencarian cepat, modal tambah OPD baru, dan Dark Mode.

import { useEffect, useMemo, useRef, useState } from "react";
import { createOpd, listOpd } from "../lib/api";
import type { Opd } from "../lib/types";
import { Plus, Check, X, ChevronDown, Building2 } from "lucide-react";

export function OpdCombobox({
  selectedId,
  onSelect,
  disabled = false,
}: {
  selectedId: number | null;
  onSelect: (opd: Opd | null) => void;
  disabled?: boolean;
}) {
  const [all, setAll] = useState<Opd[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSingkatan, setNewSingkatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Muat daftar OPD saat mount
  useEffect(() => {
    let cancelled = false;
    listOpd()
      .then((rows) => {
        if (!cancelled) setAll(rows);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  // Set query sesuai selectedId jika ada
  useEffect(() => {
    if (selectedId != null && all.length > 0) {
      const found = all.find((o) => o.id === selectedId);
      if (found) {
        setQuery(found.nama_opd);
      }
    } else if (selectedId == null) {
      setQuery("");
    }
  }, [selectedId, all]);

  // Tutup dropdown saat klik di luar (kecuali modal tambah OPD terbuka)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showModal) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (selectedId != null) {
          const found = all.find((o) => o.id === selectedId);
          if (found) setQuery(found.nama_opd);
        } else {
          setQuery("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedId, all, showModal]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.nama_opd.toLowerCase().includes(q) ||
        (o.singkatan ?? "").toLowerCase().includes(q),
    );
  }, [all, query]);

  const handlePick = (opd: Opd) => {
    setQuery(opd.nama_opd);
    setOpen(false);
    setError(null);
    onSelect(opd);
  };

  const handleClear = () => {
    setQuery("");
    onSelect(null);
  };

  // Simpan OPD Baru ke Database
  const handleSaveOpd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createOpd(
        newName.trim(),
        newSingkatan.trim() || undefined,
      );
      // Update state lokal
      setAll((prev) => [...prev, created].sort((a, b) => a.nama_opd.localeCompare(b.nama_opd)));
      handlePick(created);
      setShowModal(false);
      setNewName("");
      setNewSingkatan("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        {/* Input Combobox */}
        <div className="relative flex-1">
          <input
            type="text"
            role="combobox"
            aria-label="Pilih OPD Pengusul"
            aria-expanded={open}
            value={query}
            disabled={disabled}
            onFocus={() => {
              if (!disabled) setOpen(true);
            }}
            onClick={() => {
              if (!disabled) setOpen(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (!e.target.value) onSelect(null);
            }}
            placeholder="Ketik untuk mencari nama OPD..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-3 pr-16 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 dark:disabled:bg-slate-900 shadow-sm transition-colors"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                title="Hapus pilihan"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen((prev) => !prev)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              title="Buka daftar"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tombol Tambah OPD Baru */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setNewName(query.trim());
            setNewSingkatan("");
            setError(null);
            setShowModal(true);
            setOpen(false);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors whitespace-nowrap shadow-sm"
          title="Tambah Master OPD Baru ke Database"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>OPD Baru</span>
        </button>
      </div>

      {/* Dropdown Options List */}
      {open && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 shadow-xl text-xs sm:text-sm">
          {filtered.map((opd) => {
            const isSelected = opd.id === selectedId;
            return (
              <li
                key={opd.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handlePick(opd);
                }}
                className={`cursor-pointer px-3.5 py-2.5 transition-colors ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/80 font-semibold text-indigo-900 dark:text-indigo-200"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="leading-snug">{opd.nama_opd}</span>
                  <div className="flex items-center gap-2">
                    {opd.singkatan && (
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        {opd.singkatan}
                      </span>
                    )}
                    {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                </div>
              </li>
            );
          })}

          {filtered.length === 0 && (
            <li className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400 text-center italic">
              Tidak ada OPD dengan nama "{query}"
            </li>
          )}

          {/* Opsi Tambah OPD di bagian bawah dropdown */}
          <li
            onMouseDown={(e) => {
              e.preventDefault();
              setNewName(query.trim());
              setNewSingkatan("");
              setError(null);
              setShowModal(true);
              setOpen(false);
            }}
            className="border-t border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-950/40 px-3.5 py-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah OPD Baru {query.trim() ? `"${query.trim()}"` : ""}</span>
          </li>
        </ul>
      )}

      {/* Modal Dialog Tambah OPD Baru */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !loading) setShowModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tambah Master OPD Baru</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Daftarkan instansi / OPD pengusul baru</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-2.5 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveOpd} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap OPD <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Dinas Pekerjaan Umum dan Penataan Ruang"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Singkatan OPD <span className="text-slate-400 dark:text-slate-500 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={newSingkatan}
                  onChange={(e) => setNewSingkatan(e.target.value)}
                  placeholder="Contoh: DPUPR"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || !newName.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Menyimpan…" : "Simpan & Pilih OPD"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
