// lib/api.ts — wrapper invoke() per Tauri command.

import { invoke } from "@tauri-apps/api/core";
import type {
  CreateKoreksiDto,
  KoreksiRow,
  Opd,
} from "./types";

export type DbInfo = {
  mode: string;
  host: string;
  port: number;
  database: string;
};

export interface AppConfig {
  mode: "offline" | "online";
  database_url: string;
  storage_api_url: string;
  storage_api_key: string;
}

export async function getAppConfig(): Promise<AppConfig> {
  return invoke("get_app_config");
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  return invoke("save_app_config", { config });
}

export async function testDbConnection(url: string): Promise<string> {
  return invoke("test_db_connection", { url });
}

export async function testStorageApiConnection(
  url: string,
  apiKey?: string,
): Promise<string> {
  return invoke("test_storage_api_connection", { url, apiKey: apiKey || null });
}

export async function toggleConsole(show: boolean): Promise<boolean> {
  return invoke("toggle_console", { show });
}

export async function getDbInfo(): Promise<DbInfo> {
  return invoke("get_db_info");
}

export async function listOpd(
  search?: string,
): Promise<Opd[]> {
  return invoke("list_opd", { search });
}

export async function createOpd(
  nama_opd: string,
  singkatan?: string,
): Promise<Opd> {
  return invoke("create_opd", { namaOpd: nama_opd, singkatan });
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
  return invoke("upload_bukti", { id, sourcePath: source_path });
}

export async function pickAndUploadBukti(
  id: string,
): Promise<KoreksiRow | null> {
  return invoke("pick_and_upload_bukti", { id });
}

export interface ScannerDeviceInfo {
  id: string;
  name: string;
}

export interface ScanOptions {
  device_id?: string;
  source?: "ADF" | "Flatbed";
  dpi?: number;
  page_size?: "A4" | "F4";
  color_mode?: "Color" | "Grayscale" | "BW";
  output_format?: "PDF" | "JPG";
}

export async function listScanners(): Promise<ScannerDeviceInfo[]> {
  return invoke("list_scanners");
}

export interface StagedFile {
  source_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  data_url: string;
}

export async function pickToStaging(): Promise<StagedFile | null> {
  return invoke("pick_to_staging");
}

export async function scanToStaging(
  options?: ScanOptions,
): Promise<StagedFile | null> {
  return invoke("scan_to_staging", { options });
}

export async function scanAndUploadBukti(
  id: string,
  options?: ScanOptions,
): Promise<KoreksiRow | null> {
  return invoke("scan_and_upload_bukti", { id, options });
}

export async function deleteBukti(id: string): Promise<KoreksiRow> {
  return invoke("delete_bukti", { id });
}

export async function isNoBaUsed(
  no_ba: string,
  exclude?: string,
): Promise<boolean> {
  return invoke("is_no_ba_used", { noBa: no_ba, exclude });
}

export async function isNoTuUsed(
  no_tu: string,
  exclude?: string,
): Promise<boolean> {
  return invoke("is_no_tu_used", { noTu: no_tu, exclude });
}

export async function openBuktiPath(path: string): Promise<void> {
  return invoke("open_bukti_path", { path });
}

export async function getBuktiBase64(
  id: string,
): Promise<{ 0: string; 1: string }> {
  return invoke("get_bukti_base64", { id });
}

export async function createBackup(): Promise<string | null> {
  return invoke("create_backup");
}

export async function restoreBackup(): Promise<string | null> {
  return invoke("restore_backup");
}

// =========================================================================
// AUTENTIKASI & MANAJEMEN PENGGUNA (RBAC)
// =========================================================================

export interface UserSession {
  id: string;
  username: string;
  full_name: string;
  role: "ADMIN" | "USER";
}

export interface UserItem {
  id: string;
  username: string;
  full_name: string;
  role: "ADMIN" | "USER";
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  full_name: string;
  role: "ADMIN" | "USER";
}

export interface UpdateUserDto {
  id: string;
  full_name: string;
  role: "ADMIN" | "USER";
  is_active: boolean;
}

export async function login(
  username: string,
  password: string,
): Promise<UserSession> {
  return invoke("login", { username, password });
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  return invoke("change_password", {
    userId,
    oldPassword,
    newPassword,
  });
}

export async function getSessionUser(
  userId: string,
): Promise<UserSession | null> {
  return invoke("get_session_user", { userId });
}

export async function listUsers(): Promise<UserItem[]> {
  return invoke("list_users");
}

export async function createUser(
  payload: CreateUserDto,
): Promise<UserItem> {
  return invoke("create_user", { payload });
}

export async function updateUser(
  payload: UpdateUserDto,
): Promise<UserItem> {
  return invoke("update_user", { payload });
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  return invoke("reset_user_password", { id, newPassword });
}

export async function deleteUser(id: string): Promise<void> {
  return invoke("delete_user", { id });
}

