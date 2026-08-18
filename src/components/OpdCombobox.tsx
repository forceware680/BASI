// components/OpdCombobox.tsx — master data OPD (REQ-01).
//
//  Combobox live-search: mengetik memfilter nama/singkatan (case-insensitive).
//  Opsi "Tambah OPD baru" (inline create) [ASUMSI]. Parent memegang OPD terpilih.

import { useEffect, useMemo, useState } from "react";
import { createOpd, listOpd } from "../lib/api";
import type { Opd } from "../lib/types";

export function OpdCombobox({
  onSelect,
  disabled = false,
}: {
  onSelect: (opd: Opd) => void;
  disabled?: boolean;
}) {
  const [all, setAll] = useState<Opd[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Muat daftar OPD saat mount.
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
    setQuery("");
    setOpen(false);
    setNewName("");
    setCreating(false);
    setError(null);
    onSelect(opd);
  };

  const onCreateOpd = async () => {
    const nama = newName.trim();
    if (!nama) return;
    setLoading(true);
    setError(null);
    try {
      const opd = await createOpd(nama);
      setAll((prev) => [...prev, opd]);
      handlePick(opd);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="search"
        role="combobox"
        aria-label="Pilih OPD Pengusul"
        aria-expanded={open}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Pilih OPD pengusul…"
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-indigo-500 disabled:bg-zinc-50"
      />
      {creating && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama OPD baru"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-indigo-500"
          />
          <button
            type="button"
            disabled={loading}
            onClick={onCreateOpd}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Menyimpan…" : "Simpan OPD"}
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <ul
        className={
          open && !creating
            ? "absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-sm"
            : "hidden"
        }
      >
        {filtered.map((opd) => (
          <li
            key={opd.id}
            onMouseDown={(e) => {
              e.stopPropagation();
              handlePick(opd);
            }}
            className="cursor-pointer px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            <span className="font-medium">{opd.nama_opd}</span>
            {opd.singkatan && (
              <span className="ml-1 text-zinc-500">({opd.singkatan})</span>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-1.5 text-sm text-zinc-500">
            Tidak ada OPD aktif
          </li>
        )}
      </ul>
    </div>
  );
}
