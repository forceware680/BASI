// main.rs — SIMBASI BMD (Tauri v2) dengan integrasi Portable PostgreSQL & Cloud PostgreSQL Switcher.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)]
#![allow(deprecated)]

mod commands;
mod config;
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
    pub mode: String, // "Offline" | "Online"
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
fn get_app_config(app: tauri::AppHandle) -> Result<crate::config::AppConfig, String> {
    Ok(crate::config::load_config(&app))
}

#[tauri::command]
async fn save_app_config(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
    config: crate::config::AppConfig,
) -> Result<(), String> {
    // 1. Simpan ke berkas config.json
    crate::config::save_config(&app, &config)?;

    // 2. Jika beralih ke mode offline, pastikan PostgreSQL lokal/portabel aktif terlebih dahulu
    //    (agar hot-switch saat aplikasi berjalan tetap dapat terhubung ke server lokal).
    if config.mode == "offline" {
        let app_clone = app.clone();
        let data_dir = tauri::async_runtime::spawn_blocking(move || {
            crate::pgsql_daemon::ensure_pgsql_running(&app_clone)
        })
        .await
        .map_err(|e| format!("Gagal menjalankan proses PostgreSQL: {e}"))??;

        // Catat direktori data daemon agar dapat dihentikan dengan aman saat aplikasi keluar.
        if let Some(ref d) = data_dir {
            if let Ok(mut guard) = app.state::<PortableDbState>().0.lock() {
                *guard = Some(d.clone());
            }
        }
    }

    // 3. Hubungkan ulang DbPool ke target database baru & jalankan migrasi
    let new_pool = crate::db::connect_with_url(&config.database_url).await?;
    db_state.set_pool(new_pool).await;

    println!(
        "[CONFIG] Konfigurasi berhasil disimpan dan diterapkan. Mode: {}",
        config.mode
    );
    Ok(())
}

/// Cek kesehatan koneksi ke database yang sedang dikonfigurasi (tanpa menggantung).
/// Mengembalikan `true` bila server dapat dihubungi, `false` bila offline/timeout.
#[tauri::command]
async fn ping_db(app: tauri::AppHandle) -> Result<bool, String> {
    let cfg = crate::config::load_config(&app);
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(6),
        crate::db::test_connection(&cfg.database_url),
    )
    .await;
    Ok(matches!(result, Ok(Ok(_))))
}

#[tauri::command]
async fn test_db_connection(url: String) -> Result<String, String> {
    crate::db::test_connection(&url).await
}

#[tauri::command]
async fn test_storage_api_connection(url: String, api_key: Option<String>) -> Result<String, String> {
    crate::storage::test_storage_api(&url, &api_key.unwrap_or_default()).await
}

#[tauri::command]
fn get_db_info(app: tauri::AppHandle) -> Result<DbInfo, String> {
    let cfg = crate::config::load_config(&app);
    let opts = sqlx::postgres::PgConnectOptions::from_str(&cfg.database_url)
        .unwrap_or_default();

    Ok(DbInfo {
        mode: if cfg.mode == "online" {
            "Online (Cloud)".to_string()
        } else {
            "Offline (Lokal)".to_string()
        },
        host: opts.get_host().to_string(),
        port: opts.get_port(),
        database: opts.get_database().unwrap_or("sim_ba_koreksi").to_string(),
    })
}

use std::str::FromStr;

#[tauri::command]
async fn list_opd(
    db_state: tauri::State<'_, crate::db::DbState>,
    search: Option<String>,
) -> Result<Vec<crate::models::Opd>, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::opd::list_opd(&db, search).await?)
}

#[tauri::command]
async fn create_opd(
    db_state: tauri::State<'_, crate::db::DbState>,
    nama_opd: String,
    singkatan: Option<String>,
) -> Result<crate::models::Opd, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::opd::create_opd(&db, nama_opd, singkatan).await?)
}

#[tauri::command]
async fn list_koreksi(
    db_state: tauri::State<'_, crate::db::DbState>,
    search: Option<String>,
    status: Option<String>,
) -> Result<Vec<crate::models::KoreksiRow>, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::koreksi::list_koreksi(&db, search, status).await?)
}

#[tauri::command]
async fn get_koreksi(
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<crate::models::KoreksiRow, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::koreksi::get_koreksi(&db, &id).await?)
}

#[tauri::command]
async fn create_koreksi(
    db_state: tauri::State<'_, crate::db::DbState>,
    payload: crate::models::CreateKoreksiDto,
) -> Result<crate::models::KoreksiRow, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::koreksi::create_koreksi(&db, payload).await?)
}

#[tauri::command]
async fn update_koreksi(
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
    payload: crate::models::CreateKoreksiDto,
) -> Result<crate::models::KoreksiRow, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::koreksi::update_koreksi(&db, id, payload).await?)
}

#[tauri::command]
async fn delete_koreksi(
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(), String> {
    let db = db_state.pool().await;
    crate::commands::koreksi::delete_koreksi(&db, id).await?;
    Ok(())
}

#[tauri::command]
async fn upload_bukti(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
    source_path: String,
) -> Result<crate::models::KoreksiRow, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::bukti::upload_bukti(app, &db, id, source_path).await?)
}

#[tauri::command]
async fn pick_to_staging() -> Result<Option<crate::commands::bukti::StagedFile>, String> {
    Ok(crate::commands::bukti::pick_to_staging().await?)
}

#[tauri::command]
async fn scan_to_staging(
    options: Option<crate::commands::bukti::ScanOptions>,
) -> Result<Option<crate::commands::bukti::StagedFile>, String> {
    Ok(crate::commands::bukti::scan_to_staging(options).await?)
}

#[tauri::command]
async fn pick_and_upload_bukti(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<Option<crate::models::KoreksiRow>, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::bukti::pick_and_upload_bukti(app, &db, id).await?)
}

#[tauri::command]
async fn list_scanners() -> Result<Vec<crate::commands::bukti::ScannerDeviceInfo>, String> {
    Ok(crate::commands::bukti::list_scanners().await?)
}

#[tauri::command]
async fn scan_and_upload_bukti(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
    options: Option<crate::commands::bukti::ScanOptions>,
) -> Result<Option<crate::models::KoreksiRow>, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::bukti::scan_and_upload_bukti(app, &db, id, options).await?)
}

#[tauri::command]
async fn get_bukti_base64(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(String, String), String> {
    let db = db_state.pool().await;
    Ok(crate::commands::bukti::get_bukti_base64(app, &db, id).await?)
}

#[tauri::command]
async fn delete_bukti(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<crate::models::KoreksiRow, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::bukti::delete_bukti(app, &db, id).await?)
}

#[tauri::command]
async fn is_no_ba_used(
    db_state: tauri::State<'_, crate::db::DbState>,
    no_ba: String,
    exclude: Option<String>,
) -> Result<bool, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::koreksi::is_no_ba_used(&db, no_ba, exclude).await?)
}

#[tauri::command]
async fn is_no_tu_used(
    db_state: tauri::State<'_, crate::db::DbState>,
    no_tu: String,
    exclude: Option<String>,
) -> Result<bool, String> {
    let db = db_state.pool().await;
    Ok(crate::commands::koreksi::is_no_tu_used(&db, no_tu, exclude).await?)
}

#[tauri::command]
async fn open_bukti_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let cfg = crate::config::load_config(&app);
    let path_norm = path.replace('\\', "/");

    // Jika path berformat remote (bukti/{id}/{file}) atau aplikasi sedang dalam Mode Online
    let is_remote_path = path_norm.starts_with("bukti/")
        || (cfg.mode == "online" && !path_norm.starts_with("C:") && !path_norm.starts_with("c:") && !path_norm.starts_with("/"));

    if is_remote_path && !cfg.storage_api_url.trim().is_empty() {
        let clean_rel = path_norm.trim_start_matches("bukti/").trim_start_matches('/');
        let parts: Vec<&str> = clean_rel.split('/').collect();
        if parts.len() >= 2 {
            let k_id = parts[0];
            let fname = parts[1];
            let base_url = cfg.storage_api_url.trim_end_matches('/');
            let download_url = format!("{base_url}/api/bukti/{k_id}/{fname}");

            // Simpan ke direktori cache sementara di komputer pengguna
            let temp_dir = std::env::temp_dir().join("simbasi_cache");
            let _ = std::fs::create_dir_all(&temp_dir);
            let local_cached_file = temp_dir.join(format!("{}_{}", k_id, fname));

            // Jika belum ada di cache, unduh dari server Cloud
            if !local_cached_file.exists() {
                let client = reqwest::Client::new();
                let mut req = client.get(&download_url);
                if !cfg.storage_api_key.trim().is_empty() {
                    req = req.header("x-api-key", cfg.storage_api_key.trim());
                }
                if let Ok(resp) = req.send().await {
                    if resp.status().is_success() {
                        if let Ok(bytes) = resp.bytes().await {
                            let _ = std::fs::write(&local_cached_file, &bytes);
                        }
                    }
                }
            }

            // Buka berkas fisik di aplikasi default Windows (Adobe Acrobat, Foxit, Windows Photo, dll)
            if local_cached_file.exists() {
                return app
                    .shell()
                    .open(local_cached_file.to_string_lossy().to_string(), None)
                    .map_err(|e| format!("Gagal membuka berkas di OS: {e}"));
            }

            // Fallback: buka link di browser default
            return app
                .shell()
                .open(download_url, None)
                .map_err(|e| format!("Gagal membuka tautan berkas di browser: {e}"));
        }
    } else if path_norm.starts_with("http://") || path_norm.starts_with("https://") {
        return app
            .shell()
            .open(path_norm, None)
            .map_err(|e| format!("Gagal membuka tautan di browser: {e}"));
    }

    // Mode Offline: Buka berkas dari penyimpanan lokal Windows
    app.shell()
        .open(path, None)
        .map_err(|e| format!("Gagal membuka berkas bukti di OS: {e}"))
}

#[tauri::command]
async fn create_backup(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
) -> Result<Option<String>, String> {
    let db = db_state.pool().await;
    crate::commands::backup::create_backup(app, &db).await
}

#[tauri::command]
async fn restore_backup(
    app: tauri::AppHandle,
    db_state: tauri::State<'_, crate::db::DbState>,
) -> Result<Option<String>, String> {
    let db = db_state.pool().await;
    crate::commands::backup::restore_backup(app, &db).await
}

#[tauri::command]
async fn login(
    db_state: tauri::State<'_, crate::db::DbState>,
    username: String,
    password: String,
) -> Result<crate::models::UserSession, String> {
    let db = db_state.pool().await;
    crate::commands::auth::login(&db, username, password).await
}

#[tauri::command]
async fn change_password(
    db_state: tauri::State<'_, crate::db::DbState>,
    user_id: String,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let db = db_state.pool().await;
    crate::commands::auth::change_password(&db, user_id, old_password, new_password).await
}

#[tauri::command]
async fn get_session_user(
    db_state: tauri::State<'_, crate::db::DbState>,
    user_id: String,
) -> Result<Option<crate::models::UserSession>, String> {
    let db = db_state.pool().await;
    crate::commands::auth::get_session_user(&db, user_id).await
}

#[tauri::command]
async fn list_users(
    db_state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<crate::models::UserItem>, String> {
    let db = db_state.pool().await;
    crate::commands::users::list_users(&db).await
}

#[tauri::command]
async fn create_user(
    db_state: tauri::State<'_, crate::db::DbState>,
    payload: crate::models::CreateUserDto,
) -> Result<crate::models::UserItem, String> {
    let db = db_state.pool().await;
    crate::commands::users::create_user(&db, payload).await
}

#[tauri::command]
async fn update_user(
    db_state: tauri::State<'_, crate::db::DbState>,
    payload: crate::models::UpdateUserDto,
) -> Result<crate::models::UserItem, String> {
    let db = db_state.pool().await;
    crate::commands::users::update_user(&db, payload).await
}

#[tauri::command]
async fn reset_user_password(
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
    new_password: String,
) -> Result<(), String> {
    let db = db_state.pool().await;
    crate::commands::users::reset_user_password(&db, id, new_password).await
}

#[tauri::command]
async fn delete_user(
    db_state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(), String> {
    let db = db_state.pool().await;
    crate::commands::users::delete_user(&db, id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().level(tauri_plugin_log::log::LevelFilter::Info).build())
        .invoke_handler(tauri::generate_handler![
            toggle_console,
            get_app_config,
            save_app_config,
            ping_db,
            test_db_connection,
            test_storage_api_connection,
            get_db_info,
            list_opd,
            create_opd,
            list_koreksi,
            get_koreksi,
            create_koreksi,
            update_koreksi,
            delete_koreksi,
            upload_bukti,
            pick_to_staging,
            scan_to_staging,
            pick_and_upload_bukti,
            list_scanners,
            scan_and_upload_bukti,
            delete_bukti,
            get_bukti_base64,
            is_no_ba_used,
            is_no_tu_used,
            open_bukti_path,
            create_backup,
            restore_backup,
            login,
            change_password,
            get_session_user,
            list_users,
            create_user,
            update_user,
            reset_user_password,
            delete_user,
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

            // Muat konfigurasi aplikasi
            let config = crate::config::load_config(app.handle());

            // Jika mode offline, jalankan Portable PostgreSQL jika port 5432 belum aktif
            let portable_dir = if config.mode == "offline" {
                match crate::pgsql_daemon::ensure_pgsql_running(app.handle()) {
                    Ok(d) => d,
                    Err(e) => {
                        println!("[PGSQL ERROR] {e}");
                        None
                    }
                }
            } else {
                None
            };
            app.manage(PortableDbState(Mutex::new(portable_dir)));

            // Koneksi DB non-blocking (Lazy Pool) di dalam Tokio runtime context.
            // App tetap dapat boot meskipun server database tidak dapat dihubungi
            // (pool dibuat lazy; migrasi & seed berjalan di background, warn-only).
            let pool = tauri::async_runtime::block_on(async {
                crate::db::create_pool(&config.database_url)
            })
            .expect("Format URL database tidak valid. Periksa konfigurasi database.");
            println!("[APP] Inisialisasi pool database selesai. Mode: {}", config.mode);

            let pool_clone = pool.clone();
            let url_clone = config.database_url.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::db::run_migrations_and_seed(&pool_clone, &url_clone).await {
                    eprintln!("[DB ASYNC WARN] Inisialisasi skema background: {e}");
                }
            });
            app.manage(crate::db::DbState(tokio::sync::RwLock::new(pool)));
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
