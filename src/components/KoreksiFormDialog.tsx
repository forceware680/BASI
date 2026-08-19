// components/KoreksiFormDialog.tsx — form tambah/edit koreksi (REQ-02) dengan auto-format nomor surat dinas.

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
import { Sparkles, Info } from "lucide-react";

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
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm";

const btnPrimary =
  "rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm";

const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors";

/**
 * Format otomatis template nomor dinas: 000.2.3.2/[tengah]/440
 */
function autoFormatNomor(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return "";
  
  // Jika user hanya ketik angka/kode tengah tanpa slash (misal "1331")
  if (!trimmed.includes("/")) {
    return `000.2.3.2/${trimmed}/440`;
  }
  // Jika user ketik "1331/440"
  if (trimmed.endsWith("/440") && !trimmed.startsWith("000.2.3.2/")) {
    const middle = trimmed.replace(/\/440$/, "");
    return `000.2.3.2/${middle}/440`;
  }
  // Jika user ketik "000.2.3.2/1331"
  if (trimmed.startsWith("000.2.3.2/") && !trimmed.endsWith("/440") && !trimmed.slice(10).includes("/")) {
    return `${trimmed}/440`;
  }
  return trimmed;
}

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
    } else if (open === "create") {
      setFields(EMPTY);
    }
    setErrors({});
    setNoBaWarning(null);
  }, [open, initial]);

  // Listener tombol Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (open === null) return null;

  const update = (patch: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  // Handler auto format saat kehilangan fokus (Blur / Tab)
  const handleBlurNoTu = () => {
    if (fields.no_tu.trim()) {
      const formatted = autoFormatNomor(fields.no_tu);
      update({ no_tu: formatted });
    }
  };

  const handleBlurNoBa = () => {
    if (fields.no_ba.trim()) {
      const formatted = autoFormatNomor(fields.no_ba);
      update({ no_ba: formatted });
      handleCheckNoBaDuplicate(formatted);
    } else {
      setNoBaWarning(null);
    }
  };

  // Cek duplikat no_ba
  const handleCheckNoBaDuplicate = async (noBaValue?: string) => {
    const target = noBaValue ?? fields.no_ba.trim();
    if (!target) {
      setNoBaWarning(null);
      return;
    }
    try {
      const dup = await isNoBaUsed(target, initial?.id ?? undefined);
      if (dup) {
        setNoBaWarning(`Perhatian: No. BA "${target}" sudah pernah digunakan pada data lain.`);
      } else {
        setNoBaWarning(null);
      }
    } catch {
      // Abaikan jika error jaringan/DB saat live check
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fields.no_tu.trim()) e.no_tu = "No. Surat TU wajib diisi.";
    if (!fields.no_ba.trim()) e.no_ba = "No. BA Koreksi wajib diisi.";
    if (fields.opd_id == null) e.opd_id = "OPD Pengusul wajib diisi.";
    if (!fields.tanggal_surat.trim()) {
      e.tanggal_surat = "Tanggal Surat wajib diisi.";
    } else if (fields.tanggal_surat > todayIso()) {
      e.tanggal_surat = "Tanggal surat tidak boleh melebihi hari ini.";
    }
    if (!fields.penjelasan_koreksi.trim()) e.penjelasan_koreksi = "Uraian Koreksi wajib diisi.";
    return e;
  };

  const submit = async (printAfter: boolean) => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      const payload = {
        no_tu: autoFormatNomor(fields.no_tu),
        no_ba: autoFormatNomor(fields.no_ba),
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
      setErrors((prev) => ({ ...prev, _form: String(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {open === "edit" ? "Edit Koreksi BMD" : "Tambah Koreksi BMD"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {errors._form && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errors._form}
          </div>
        )}

        <div className="space-y-3.5">
          {/* No Surat TU */}
          <Field
            label="No. Surat TU"
            error={errors.no_tu}
            hint="Ketik nomor tengah (contoh: 1991), otomatis terformat 000.2.3.2/1991/440 saat tekan Tab."
          >
            <div className="relative">
              <input
                type="text"
                value={fields.no_tu}
                onChange={(e) => update({ no_tu: e.target.value })}
                onBlur={handleBlurNoTu}
                placeholder="Contoh: 1991 atau 000.2.3.2/1991/440"
                className={inputCls}
                maxLength={100}
              />
              {fields.no_tu && !fields.no_tu.startsWith("000.2.3.2/") && (
                <button
                  type="button"
                  onClick={handleBlurNoTu}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  title="Format ke 000.2.3.2/[nomor]/440"
                >
                  <Sparkles className="h-3 w-3" />
                  Format
                </button>
              )}
            </div>
          </Field>

          {/* No BA Koreksi */}
          <Field
            label="No. BA Koreksi"
            error={errors.no_ba}
            hint="Ketik nomor tengah (contoh: 129/1992 atau 441), otomatis terformat saat tekan Tab."
          >
            <div className="relative">
              <input
                type="text"
                value={fields.no_ba}
                onChange={(e) => update({ no_ba: e.target.value })}
                onBlur={handleBlurNoBa}
                placeholder="Contoh: 129/1992/440 atau 441/1932/440"
                className={inputCls}
                maxLength={100}
              />
              {fields.no_ba && !fields.no_ba.startsWith("000.2.3.2/") && !fields.no_ba.includes("/") && (
                <button
                  type="button"
                  onClick={handleBlurNoBa}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  title="Format ke 000.2.3.2/[nomor]/440"
                >
                  <Sparkles className="h-3 w-3" />
                  Format
                </button>
              )}
            </div>
            {noBaWarning && (
              <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                {noBaWarning}
              </p>
            )}
          </Field>

          <Field label="OPD Pengusul" error={errors.opd_id}>
            <OpdCombobox
              selectedId={fields.opd_id}
              onSelect={(opd) => update({ opd_id: opd ? opd.id : null })}
            />
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
              placeholder="Rincian aset / barang yang dikoreksi..."
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(false)}
            className={btnPrimary}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "Menyimpan…" : "Simpan & Cetak"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="block text-xs font-bold text-slate-700">{label}</span>
        {hint && (
          <div className="group relative inline-flex items-center">
            <Info className="h-3.5 w-3.5 text-slate-400 hover:text-indigo-600 cursor-help transition-colors" />
            <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-64 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-medium text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed">
              {hint}
              <div className="absolute top-full left-2 border-4 border-transparent border-t-slate-900" />
            </div>
          </div>
        )}
      </div>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>}
    </div>
  );
}
