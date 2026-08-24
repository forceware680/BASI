// lib/types.ts — tipe mirror dari struct Rust (crate::models).

export type StatusTandaTerima = "MENUNGGU_BUKTI" | "SELESAI";

export interface Opd {
  id: number;
  nama_opd: string;
  singkatan: string | null;
  is_active: boolean;
}

export interface CreateKoreksiDto {
  no_tu: string;
  no_ba: string;
  opd_id: number;
  /** 'YYYY-MM-DD' */
  tanggal_surat: string;
  penjelasan_koreksi: string;
  created_by?: string | null;
}

export interface KoreksiRow {
  id: string;
  no_tu: string;
  no_ba: string;
  opd_id: number;
  /** hasil join master_opd */
  nama_opd: string;
  /** 'YYYY-MM-DD' */
  tanggal_surat: string;
  penjelasan_koreksi: string;
  status: StatusTandaTerima;
  file_name: string | null;
  file_type: string | null;
  uploaded_at: string | null;
  created_at: string;
  /** path storage file bukti (internal). */
  file_path: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
}

/** Helper: hari ini (YYYY-MM-DD). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Format tanggal id-ID: DD MMM YYYY. */
export function formatTanggal(id: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const parts = id.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return id;
  const [y, m, d] = parts;
  return `${d} ${months[m - 1]} ${y}`;
}
