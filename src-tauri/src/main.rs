// main.rs — SIM-BA Koreksi BMD (Tauri v2).

#![allow(dead_code)]
#![allow(deprecated)]

mod commands;
mod db;
mod models;
mod storage;

use tauri::Manager;
use tauri_plugin_shell::ShellExt;

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
            open_bukti_path,
            create_backup,
            restore_backup,
        ])
        .setup(|app| {
            // Koneksi DB + migrasi idempoten (T-10: auto-connect saat restart).
            let pool = tauri::async_runtime::block_on(crate::db::connect())
                .expect("Tidak dapat terhubung ke database. Periksa layanan PostgreSQL.");
            app.manage(pool);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
