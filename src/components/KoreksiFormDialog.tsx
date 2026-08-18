// components/KoreksiFormDialog.tsx — form tambah/edit koreksi (REQ-02).
//
//  Field: no_tu, no_ba, opd_id (combobox), tanggal_surat, penjelasan_koreksi.
//  Tombol "Simpan" dan "Simpan & Cetak" [ASUMSI shortcut].

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  createKoreksi,
  isNoBaUsed,
  updateKoreksi,
} from "../lib/api";
import { todayIso } from "../lib/types";
import type { KoreksiRow } from "../lib/types";
import { OpdCombobox } from "./OpdCombobox";

type FormMode = "create" | "edit";

type Fields = {
  no_tu: string;
  no_ba: string;
  opd_id: number | null;
  tanggal_surat: string;
  penjelasan_koreksi: string;
};

const EMPTY: Fields = {
  no_tu: "",
  no_ba: "",
  opd_id: null,
  tanggal_surat: todayIso(),
  penjelasan_koreksi: "",
};

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-indigo-500";

const btnPrimary =
  "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";

export function KoreksiFormDialog({
  open,
  initial,
  onClose,
  onSaved,
  onPrint,
}: {
  open: FormMode | null;
  initial: KoreksiRow | null;
  onClose: () => void;
  onSaved: (row: KoreksiRow) => void;
  onPrint: (row: KoreksiRow) => void;
}) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noBaWarning, setNoBaWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Prefill saat dialog buka (mode edit); reset saat create.
  useEffect(() => {
    if (open === "edit" && initial) {
      setFields({
        no_tu: initial.no_tu,
        no_ba: initial.no_ba,
        opd_id: initial.opd_id,
        tanggal_surat: initial.tanggal_surat,
        penjelasan_koreksi: initial.penjelasan_koreksi,
      });
    } else {
      setFields(EMPTY);
    }
    setErrors({});
    setNoBaWarning(null);
  }, [open, initial]);

  if (open === null) return null;

  const update = (patch: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fields.no_tu.trim()) e.no_tu = "No. Surat TU wajib diisi.";
    if (!fields.no_ba.trim()) e.no_ba = "No. BA Koreksi wajib diisi.";
    if (fields.opd_id == null) e.opd_id = "OPD Pengusul wajib diisi.";
    if (!fields.tanggal_surat.trim()) e.tanggal_surat = "Tanggal Surat wajib diisi.";
    if (!fields.penjelasan_koreksi.trim()) e.penjelasan_koreksi = "Uraian Koreksi wajib diisi.";
    return e;
  };

  const submit = async (printAfter: boolean) => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    setNoBaWarning(null);
    try {
      // Duplikat no_ba (warning, bukan blokir) [ASUMSI].
      const dup = await isNoBaUsed(fields.no_ba, initial?.id ?? undefined);
      if (dup) {
        setNoBaWarning(`No. BA "${fields.no_ba}" sudah pernah dipakai record lain.`);
      }

      const payload = {
        no_tu: fields.no_tu.trim(),
        no_ba: fields.no_ba.trim(),
        opd_id: fields.opd_id as number,
        tanggal_surat: fields.tanggal_surat,
        penjelasan_koreksi: fields.penjelasan_koreksi.trim(),
      };
      const row =
        open === "edit" && initial
          ? await updateKoreksi(initial.id, payload)
          : await createKoreksi(payload);
      onSaved(row);
      if (printAfter) onPrint(row);
    } catch (err) {
      setNoBaWarning(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">
          {open === "edit" ? "Edit Koreksi BMD" : "Tambah Koreksi BMD"}
        </h2>

        <div className="space-y-3">
          <Field label="No. Surat TU" error={errors.no_tu}>
            <input
              type="text"
              value={fields.no_tu}
              onChange={(e) => update({ no_tu: e.target.value })}
              className={inputCls}
              maxLength={100}
            />
          </Field>

          <Field label="No. BA Koreksi" error={errors.no_ba}>
            <input
              type="text"
              value={fields.no_ba}
              onChange={(e) => update({ no_ba: e.target.value })}
              className={inputCls}
              maxLength={100}
            />
            {noBaWarning && (
              <p className="mt-1 text-xs text-amber-700">{noBaWarning}</p>
            )}
          </Field>

          <Field label="OPD Pengusul" error={errors.opd_id}>
            <OpdCombobox onSelect={(opd) => update({ opd_id: opd.id })} />
          </Field>

          <Field label="Tanggal Surat" error={errors.tanggal_surat}>
            <input
              type="date"
              value={fields.tanggal_surat}
              onChange={(e) => update({ tanggal_surat: e.target.value })}
              className={inputCls}
              max={todayIso()}
            />
          </Field>

          <Field label="Uraian Koreksi" error={errors.penjelasan_koreksi}>
            <textarea
              rows={3}
              value={fields.penjelasan_koreksi}
              onChange={(e) => update({ penjelasan_koreksi: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button type="button" disabled={saving} onClick={() => submit(false)} className={btnPrimary}>
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
          <button type="button" disabled={saving} onClick={() => submit(true)} className={btnPrimary}>
            {saving ? "Menyimpan…" : "Simpan & Cetak"}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
