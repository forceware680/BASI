import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  createKoreksi,
  isNoBaUsed,
  isNoTuUsed,
  updateKoreksi,
} from "../lib/api";
import { todayIso } from "../lib/types";
import type { KoreksiRow } from "../lib/types";
import { OpdCombobox } from "./OpdCombobox";
import { Sparkles, Info } from "lucide-react";
import { useAuth } from "../lib/auth";

type FormMode = "create" | "edit";

type Fields = {
  no_tu: string;
  no_ba: string;
  opd_id: number | null;
  tanggal_surat: string;
  penjelasan_koreksi: string;
};

function getEmptyFields(): Fields {
  return {
    no_tu: "",
    no_ba: "",
    opd_id: null,
    tanggal_surat: todayIso(),
    penjelasan_koreksi: "",
  };
}

const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-colors";

const btnPrimary =
  "rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm";

const btnSecondary =
  "rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";

/**
 * Format otomatis template nomor dinas
 */
function autoFormatNomor(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) {
    return `000.2.3.2/${trimmed}/440`;
  }
  if (/^\d+\/\d+$/.test(trimmed)) {
    return `000.2.3.2/${trimmed}`;
  }
  if (/^000\.2\.3\.2\/\d+$/.test(trimmed)) {
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
  const { user } = useAuth();
  const [fields, setFields] = useState<Fields>(getEmptyFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (open === "edit" && initial) {
      setFields({
        no_tu: initial.no_tu,
        no_ba: initial.no_ba,
        opd_id: initial.opd_id,
        tanggal_surat: initial.tanggal_surat,
        penjelasan_koreksi: initial.penjelasan_koreksi,
      });
    } else {
      setFields(getEmptyFields());
    }
    setErrors({});
  }, [open, initial]);

  const update = (patch: Partial<Fields>) =>
    setFields((prev) => ({ ...prev, ...patch }));

  // Auto-format saat No TU blur / tab + cek duplikat
  const handleBlurNoTu = async () => {
    if (fields.no_tu) {
      const formatted = autoFormatNomor(fields.no_tu);
      if (formatted !== fields.no_tu) {
        update({ no_tu: formatted });
      }
      const raw = (formatted || fields.no_tu).trim();
      const exclude = open === "edit" && initial ? initial.id : undefined;
      const used = await isNoTuUsed(raw, exclude).catch(() => false);
      if (used) {
        setErrors((prev) => ({ ...prev, no_tu: `No. Surat TU "${raw}" sudah terdaftar.` }));
      } else {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.no_tu;
          return next;
        });
      }
    }
  };

  // Auto-format saat No BA blur / tab + cek duplikat
  const handleBlurNoBa = async () => {
    if (fields.no_ba) {
      const formatted = autoFormatNomor(fields.no_ba);
      if (formatted !== fields.no_ba) {
        update({ no_ba: formatted });
      }
      const raw = (formatted || fields.no_ba).trim();
      const exclude = open === "edit" && initial ? initial.id : undefined;
      const used = await isNoBaUsed(raw, exclude).catch(() => false);
      if (used) {
        setErrors((prev) => ({ ...prev, no_ba: `No. BA Koreksi "${raw}" sudah terdaftar.` }));
      } else {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.no_ba;
          return next;
        });
      }
    }
  };

  const validate = async (): Promise<boolean> => {
    const errs: Record<string, string> = {};
    const noTu = fields.no_tu.trim();
    const noBa = fields.no_ba.trim();

    if (!noTu) errs.no_tu = "No. Surat TU wajib diisi.";
    if (!noBa) errs.no_ba = "No. BA Koreksi wajib diisi.";
    if (!fields.opd_id) errs.opd_id = "Pilih OPD pengusul.";
    if (!fields.tanggal_surat) errs.tanggal_surat = "Tanggal surat wajib diisi.";
    if (fields.tanggal_surat > todayIso()) {
      errs.tanggal_surat = "Tanggal tidak boleh di masa depan.";
    }
    if (!fields.penjelasan_koreksi.trim()) {
      errs.penjelasan_koreksi = "Uraian penjelasan koreksi wajib diisi.";
    }

    const exclude = open === "edit" && initial ? initial.id : undefined;

    // Validasi duplikat asynchronous
    if (noTu && !errs.no_tu) {
      const tuUsed = await isNoTuUsed(noTu, exclude).catch(() => false);
      if (tuUsed) {
        errs.no_tu = `No. Surat TU "${noTu}" sudah terdaftar dalam sistem.`;
      }
    }

    if (noBa && !errs.no_ba) {
      const baUsed = await isNoBaUsed(noBa, exclude).catch(() => false);
      if (baUsed) {
        errs.no_ba = `No. BA Koreksi "${noBa}" sudah terdaftar dalam sistem.`;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (printAfter = false) => {
    const valid = await validate();
    if (!valid) return;
    setSaving(true);
    try {
      const dto = {
        no_tu: fields.no_tu.trim(),
        no_ba: fields.no_ba.trim(),
        opd_id: fields.opd_id!,
        tanggal_surat: fields.tanggal_surat,
        penjelasan_koreksi: fields.penjelasan_koreksi.trim(),
        created_by: user?.id || null,
      };
      let row: KoreksiRow;
      if (open === "edit" && initial) {
        row = await updateKoreksi(initial.id, dto);
      } else {
        row = await createKoreksi(dto);
      }
      onSaved(row);
      if (printAfter) onPrint(row);
    } catch (err) {
      const errMsg = String(err);
      if (errMsg.toLowerCase().includes("no. surat tu") || errMsg.toLowerCase().includes("no_tu")) {
        setErrors((prev) => ({ ...prev, no_tu: errMsg }));
      } else if (errMsg.toLowerCase().includes("no. ba") || errMsg.toLowerCase().includes("no_ba")) {
        setErrors((prev) => ({ ...prev, no_ba: errMsg }));
      } else {
        setErrors((prev) => ({ ...prev, _form: errMsg }));
      }
    } finally {
      setSaving(false);
    }
  };

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  // Hotkeys Modal:
  // - Escape: Tutup modal
  // - Ctrl+S / Cmd+S: Simpan
  // - Ctrl+Shift+S / Cmd+Shift+S: Simpan & Cetak
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          submitRef.current(true);
        } else {
          submitRef.current(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl transition-colors">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {open === "edit" ? "Edit Koreksi BMD" : "Tambah Koreksi BMD"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {errors._form && (
          <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800"
                  title="Format ke 000.2.3.2/[nomor]/440"
                >
                  <Sparkles className="h-3 w-3" />
                  Format
                </button>
              )}
            </div>
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

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
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
        <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
        {hint && (
          <div className="group relative inline-flex items-center">
            <Info className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-help transition-colors" />
            <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-64 rounded-lg bg-slate-900 dark:bg-slate-800 px-3 py-2 text-[11px] font-medium text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed border border-slate-700">
              {hint}
              <div className="absolute top-full left-2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
            </div>
          </div>
        )}
      </div>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
