// main.rs — SIMBASI BMD (Tauri v2) dengan integrasi Portable PostgreSQL auto-managed & status info.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)]
#![allow(deprecated)]

mod commands;
mod db;
mod models;
mod pgsql_daemon;
mod storage;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

pub struct PortableDbState(pub Mutex<Option<PathBuf>>);

#[derive(serde::Serialize)]
pub struct DbInfo {
    pub mode: String, // "Portable" | "Standalone"
    pub host: String,
    pub port: u16,
    pub database: String,
}

#[cfg(windows)]
extern "system" {
    fn GetConsoleWindow() -> isize;
    fn ShowWindow(hWnd: isize, nCmdShow: i32) -> i32;
    fn AllocConsole() -> i32;
}

#[tauri::command]
fn toggle_console(show: bool) -> Result<bool, String> {
    #[cfg(windows)]
    unsafe {
        let hwnd = GetConsoleWindow();
        if hwnd == 0 {
            if show {
                AllocConsole();
            }
        } else {
            ShowWindow(hwnd, if show { 5 /* SW_SHOW */ } else { 0 /* SW_HIDE */ });
        }
    }
    Ok(show)
}

#[tauri::command]
fn get_db_info(state: tauri::State<'_, PortableDbState>) -> Result<DbInfo, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let is_portable = guard.is_some();
    Ok(DbInfo {
        mode: if is_portable { "Portable".to_string() } else { "Standalone".to_string() },
        host: "127.0.0.1".to_string(),
        port: 5432,
        database: "sim_ba_koreksi".to_string(),
    })
}

#[tauri::command]
async fn list_opd(db: tauri::State<'_, crate::db::DbPool>, search: Option<String>) -> Result<Vec<crate::models::Opd>, String> {
    Ok(crate::commands::opd::list_opd(&db, search).await?)
}

#[tauri::command]
async fn create_opd(db: tauri::State<'_, crate::db::DbPool>, nama_opd: String, singkatan: Option<String>) -> Result<crate::models::Opd, String> {
    Ok(crate::commands::opd::create_opd(&db, nama_opd, singkatan).await?)
}

#[tauri::command]
async fn list_koreksi(db: tauri::State<'_, crate::db::DbPool>, search: Option<String>, status: Option<String>) -> Result<Vec<crate::models::KoreksiRow>, String> {
    Ok(crate::commands::koreksi::list_koreksi(&db, search, status).await?)
}

#[tauri::command]
async fn get_koreksi(db: tauri::State<'_, crate::db::DbPool>, id: String) -> Result<crate::models::KoreksiRow, String> {
    Ok(crate::commands::koreksi::get_koreksi(&db, &id).await?)
}

#[tauri::command]
async fn create_koreksi(db: tauri::State<'_, crate::db::DbPool>, payload: crate::models::CreateKoreksiDto) -> Result<crate::models::KoreksiRow, String> {
    Ok(crate::commands::koreksi::create_koreksi(&db, payload).await?)
}

#[tauri::command]
async fn update_koreksi(db: tauri::State<'_, crate::db::DbPool>, id: String, payload: crate::models::CreateKoreksiDto) -> Result<crate::models::KoreksiRow, String> {
    Ok(crate::commands::koreksi::update_koreksi(&db, id, payload).await?)
}

#[tauri::command]
async fn delete_koreksi(db: tauri::State<'_, crate::db::DbPool>, id: String) -> Result<(), String> {
    crate::commands::koreksi::delete_koreksi(&db, id).await?;
    Ok(())
}

#[tauri::command]
async fn upload_bukti(app: tauri::AppHandle, db: tauri::State<'_, crate::db::DbPool>, id: String, source_path: String) -> Result<crate::models::KoreksiRow, String> {
    Ok(crate::commands::bukti::upload_bukti(app, &db, id, source_path).await?)
}

#[tauri::command]
async fn pick_and_upload_bukti(app: tauri::AppHandle, db: tauri::State<'_, crate::db::DbPool>, id: String) -> Result<Option<crate::models::KoreksiRow>, String> {
    Ok(crate::commands::bukti::pick_and_upload_bukti(app, &db, id).await?)
}

#[tauri::command]
async fn get_bukti_base64(db: tauri::State<'_, crate::db::DbPool>, id: String) -> Result<(String, String), String> {
    Ok(crate::commands::bukti::get_bukti_base64(&db, id).await?)
}

#[tauri::command]
async fn delete_bukti(db: tauri::State<'_, crate::db::DbPool>, id: String) -> Result<crate::models::KoreksiRow, String> {
    Ok(crate::commands::bukti::delete_bukti(&db, id).await?)
}

#[tauri::command]
async fn is_no_ba_used(db: tauri::State<'_, crate::db::DbPool>, no_ba: String, exclude: Option<String>) -> Result<bool, String> {
    Ok(crate::commands::koreksi::is_no_ba_used(&db, no_ba, exclude).await?)
}

#[tauri::command]
async fn is_no_tu_used(db: tauri::State<'_, crate::db::DbPool>, no_tu: String, exclude: Option<String>) -> Result<bool, String> {
    Ok(crate::commands::koreksi::is_no_tu_used(&db, no_tu, exclude).await?)
}

#[tauri::command]
#[allow(deprecated)]
async fn open_bukti_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.shell().open(path, None).map_err(|_| "Gagal membuka file bukti.".to_string())
}

#[tauri::command]
async fn create_backup(app: tauri::AppHandle, db: tauri::State<'_, crate::db::DbPool>) -> Result<Option<String>, String> {
    crate::commands::backup::create_backup(app, &db).await
}

#[tauri::command]
async fn restore_backup(app: tauri::AppHandle, db: tauri::State<'_, crate::db::DbPool>) -> Result<Option<String>, String> {
    crate::commands::backup::restore_backup(app, &db).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().level(tauri_plugin_log::log::LevelFilter::Info).build())
        .invoke_handler(tauri::generate_handler![
            toggle_console,
            get_db_info,
            list_opd,
            create_opd,
            list_koreksi,
            get_koreksi,
            create_koreksi,
            update_koreksi,
            delete_koreksi,
            upload_bukti,
            pick_and_upload_bukti,
            delete_bukti,
            get_bukti_base64,
            is_no_ba_used,
            is_no_tu_used,
            open_bukti_path,
            create_backup,
            restore_backup,
        ])
        .setup(|app| {
            println!("============================================================");
            println!("  SIMBASI BMD — Subid Penatausahaan Aset BPKAD");
            println!("  Pemerintah Kota Magelang");
            println!("  Console Log & Activity Monitor Aktif");
            println!("============================================================");

            // Sembunyikan console window CMD saat startup Windows secara default
            #[cfg(windows)]
            unsafe {
                let hwnd = GetConsoleWindow();
                if hwnd != 0 {
                    ShowWindow(hwnd, 0 /* SW_HIDE */);
                }
            }

            // Auto-detect dan jalankan PostgreSQL portable jika port 5432 belum aktif
            let portable_dir = match crate::pgsql_daemon::ensure_pgsql_running(app.handle()) {
                Ok(d) => d,
                Err(e) => {
                    println!("[PGSQL ERROR] {e}");
                    None
                }
            };
            app.manage(PortableDbState(Mutex::new(portable_dir)));

            // Koneksi DB + auto-create database & migrasi idempoten saat startup
            let pool = tauri::async_runtime::block_on(crate::db::connect())
                .expect("Tidak dapat terhubung ke database. Periksa layanan PostgreSQL.");
            println!("[APP] Inisialisasi aplikasi selesai. Siap melayani permintaan.");
            app.manage(pool);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<PortableDbState>() {
                    if let Ok(guard) = state.0.lock() {
                        if let Some(ref data_dir) = *guard {
                            crate::pgsql_daemon::stop_portable_pgsql(&app, data_dir);
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
