// lib/api.ts — wrapper invoke() per Tauri command.
//
//  Semua command backend (src-tauri/src/commands). Pesan error (Bahasa
//  Indonesia) dikirim oleh Rust; wrapper tinggal forward.

import { invoke } from "@tauri-apps/api/core";
import type {
  CreateKoreksiDto,
  KoreksiRow,
  Opd,
} from "./types";

export async function listOpd(
  search?: string,
): Promise<Opd[]> {
  return invoke("list_opd", { search });
}

export async function createOpd(
  nama_opd: string,
  singkatan?: string,
): Promise<Opd> {
  return invoke("create_opd", { nama_opd, singkatan });
}

export async function listKoreksi(
  search?: string,
  status?: string,
): Promise<KoreksiRow[]> {
  return invoke("list_koreksi", { search, status });
}

export async function getKoreksi(id: string): Promise<KoreksiRow> {
  return invoke("get_koreksi", { id });
}

export async function createKoreksi(
  payload: CreateKoreksiDto,
): Promise<KoreksiRow> {
  return invoke("create_koreksi", { payload });
}

export async function updateKoreksi(
  id: string,
  payload: CreateKoreksiDto,
): Promise<KoreksiRow> {
  return invoke("update_koreksi", { id, payload });
}

export async function deleteKoreksi(id: string): Promise<void> {
  return invoke("delete_koreksi", { id });
}

export async function uploadBukti(
  id: string,
  source_path: string,
): Promise<KoreksiRow> {
  return invoke("upload_bukti", { id, source_path });
}

export async function isNoBaUsed(
  no_ba: string,
  exclude?: string,
): Promise<boolean> {
  return invoke("is_no_ba_used", { no_ba, exclude });
}

export async function openBuktiPath(path: string): Promise<void> {
  return invoke("open_bukti_path", { path });
}

export async function getBuktiBase64(
  id: string,
): Promise<{ 0: string; 1: string }> {
  return invoke("get_bukti_base64", { id });
}
