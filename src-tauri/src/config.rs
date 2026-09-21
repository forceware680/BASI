// config.rs — Pengelolaan konfigurasi aplikasi (Mode Offline/Online, URL Database, & File API).

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

pub const DEFAULT_LOCAL_DB_URL: &str =
    "postgresql://postgres:postgres@localhost:5432/sim_ba_koreksi";

pub const DEFAULT_ONLINE_DB_URL: &str =
    "postgres://postgres:XSRMfNGXXAd7aRvTyanmMGbcRLIVDmxB4nf5CwFEU4g5j7VYKTvVxEWMcvRsT8bH@45.198.155.126:27492/sim_ba_koreksi";

pub const DEFAULT_STORAGE_API_URL: &str = "http://simbasi.bpkad.web.id";
pub const DEFAULT_STORAGE_API_KEY: &str = "simbasi_secret_key_bpkad_magelang";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    /// "offline" | "online"
    pub mode: String,
    pub database_url: String,
    pub storage_api_url: String,
    pub storage_api_key: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mode: "offline".to_string(),
            database_url: DEFAULT_LOCAL_DB_URL.to_string(),
            storage_api_url: "".to_string(),
            storage_api_key: "".to_string(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Gagal mengakses AppData: {e}"))?;
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    Ok(dir.join("config.json"))
}

pub fn load_config(app: &tauri::AppHandle) -> AppConfig {
    if let Ok(path) = config_path(app) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut cfg) = serde_json::from_str::<AppConfig>(&content) {
                    if cfg.mode == "online" {
                        if cfg.storage_api_url.trim().is_empty() {
                            cfg.storage_api_url = DEFAULT_STORAGE_API_URL.to_string();
                        }
                        if cfg.storage_api_key.trim().is_empty() {
                            cfg.storage_api_key = DEFAULT_STORAGE_API_KEY.to_string();
                        }
                    }
                    return cfg;
                }
            }
        }
    }
    AppConfig::default()
}

pub fn save_config(app: &tauri::AppHandle, cfg: &AppConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let json_bytes = serde_json::to_vec_pretty(cfg)
        .map_err(|e| format!("Gagal memformat konfigurasi: {e}"))?;
    fs::write(&path, json_bytes)
        .map_err(|e| format!("Gagal menyimpan berkas konfigurasi: {e}"))?;
    Ok(())
}
