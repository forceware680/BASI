// storage.rs — kelola file bukti di {app_data_dir}/bukti/{koreksi_id}/ (Offline)
// atau via Remote File API Microservice (Online).

use base64::Engine;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Sanitasi nama file: lowercase, spasi/tik → '_', buang selain [a-z0-9._-].
pub fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| {
            let l = c.to_ascii_lowercase();
            match l {
                'a'..='z' | '0'..='9' | '_' | '.' | '-' => l,
                _ => {
                    if l.is_whitespace() {
                        '_'
                    } else {
                        '\x00'
                    }
                }
            }
        })
        .filter(|c| *c != '\x00')
        .collect()
}

/// Root folder aplikasi (dari PathResolver). {app_data_dir} = %APPDATA%/{identifier}.
pub fn app_root(app: &tauri::AppHandle) -> std::io::Result<PathBuf> {
    app.path().app_data_dir().map_err(|e| std::io::Error::other(e.to_string()))
}

/// Folder bukti lokal untuk satu koreksi: {app_data_dir}/bukti/{koreksi_id}
pub fn bukti_dir(app: &tauri::AppHandle, koreksi_id: &str) -> std::io::Result<PathBuf> {
    Ok(app_root(app)?.join("bukti").join(koreksi_id))
}

/// Salin file `source` ke {bukti_dir}/{timestamp}_{nama_sanitasi}, kembalikan path tujuan.
pub fn copy_bukti(
    app: &tauri::AppHandle,
    koreksi_id: &str,
    source: &str,
) -> std::io::Result<std::path::PathBuf> {
    let dir = bukti_dir(app, koreksi_id)?;
    fs::create_dir_all(&dir)?;
    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let base = Path::new(source);
    let name = base
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "bukti".to_string());
    let target = dir.join(format!("{}_{}", ts, sanitize(&name)));
    fs::copy(source, &target)?;
    Ok(target)
}

/// Hapus file bukti lokal dari storage.
pub fn remove_file(path: &str) {
    if path.starts_with("http://") || path.starts_with("https://") || path.starts_with("bukti/") {
        // Jalankan background delete untuk remote file jika memungkinkan
        return;
    }
    let _ = fs::remove_file(path);
}

/// Baca file bukti lokal → (mime, data_url) untuk viewer.
pub fn read_bukti_as_data_url(path: &str) -> std::io::Result<(String, String)> {
    let bytes = fs::read(path)?;
    let mime = if path.ends_with(".pdf") {
        "application/pdf"
    } else if path.ends_with(".png") {
        "image/png"
    } else {
        "image/jpeg"
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime, encoded);
    Ok((mime.to_string(), data_url))
}

// =========================================================================
// REMOTE FILE API INTEGRATION (MODE ONLINE)
// =========================================================================

#[derive(serde::Deserialize)]
struct UploadApiResponse {
    pub success: bool,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(serde::Deserialize)]
struct Base64ApiResponse {
    pub mime_type: String,
    pub data_url: String,
}

/// Unggah file ke remote File API Service (Mode Online).
pub async fn upload_to_remote(
    storage_api_url: &str,
    api_key: &str,
    koreksi_id: &str,
    source_path: &str,
) -> Result<(String, String, String), String> {
    let client = reqwest::Client::new();
    let file_bytes = tokio::fs::read(source_path)
        .await
        .map_err(|e| format!("Gagal membaca berkas asal: {e}"))?;

    let file_name = Path::new(source_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "bukti".to_string());

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name.clone());

    let form = reqwest::multipart::Form::new()
        .text("koreksi_id", koreksi_id.to_string())
        .part("file", part);

    let base_url = storage_api_url.trim_end_matches('/');
    let target_url = format!("{base_url}/api/bukti/upload");

    let mut req = client.post(&target_url).multipart(form);
    if !api_key.trim().is_empty() {
        req = req.header("x-api-key", api_key.trim());
    }

    let resp = req.send().await.map_err(|e| {
        format!("Gagal menghubungi File API Service di {base_url}: {e}")
    })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("File API Service mengembalikan error ({status}): {body}"));
    }

    let res_json: UploadApiResponse = resp.json().await.map_err(|e| {
        format!("Format balasan File API Service tidak valid: {e}")
    })?;

    if !res_json.success {
        return Err("File API Service gagal memproses unggahan berkas.".to_string());
    }

    // Kembalikan (file_path, file_name, file_type)
    Ok((res_json.file_path, res_json.file_name, res_json.file_type))
}

/// Baca file dari remote File API Service sebagai data URL (Viewer / Preview).
pub async fn read_remote_as_data_url(
    storage_api_url: &str,
    api_key: &str,
    stored_path: &str,
) -> Result<(String, String), String> {
    let base_url = storage_api_url.trim_end_matches('/');
    
    // stored_path berformat: "bukti/{koreksi_id}/{filename}" atau URL penuh
    let clean_rel = stored_path.trim_start_matches("bukti/").trim_start_matches('/');
    let parts: Vec<&str> = clean_rel.split('/').collect();
    if parts.len() < 2 {
        return Err(format!("Format path remote tidak valid: {stored_path}"));
    }
    let koreksi_id = parts[0];
    let filename = parts[1];

    let target_url = format!("{base_url}/api/bukti/base64/{koreksi_id}/{filename}");
    let client = reqwest::Client::new();
    let mut req = client.get(&target_url);
    if !api_key.trim().is_empty() {
        req = req.header("x-api-key", api_key.trim());
    }

    let resp = req.send().await.map_err(|e| {
        format!("Gagal menghubungi File API Service untuk mengambil berkas: {e}")
    })?;

    if !resp.status().is_success() {
        return Err(format!("Gagal memuat berkas bukti dari server (HTTP {}).", resp.status()));
    }

    let body: Base64ApiResponse = resp.json().await.map_err(|e| {
        format!("Gagal memparsing data bukti: {e}")
    })?;

    Ok((body.mime_type, body.data_url))
}

/// Hapus file dari remote File API Service.
pub async fn delete_remote_file(
    storage_api_url: &str,
    api_key: &str,
    stored_path: &str,
) -> Result<(), String> {
    let base_url = storage_api_url.trim_end_matches('/');
    let clean_rel = stored_path.trim_start_matches("bukti/").trim_start_matches('/');
    let parts: Vec<&str> = clean_rel.split('/').collect();
    if parts.len() < 2 {
        return Ok(());
    }
    let koreksi_id = parts[0];
    let filename = parts[1];

    let target_url = format!("{base_url}/api/bukti/{koreksi_id}/{filename}");
    let client = reqwest::Client::new();
    let mut req = client.delete(&target_url);
    if !api_key.trim().is_empty() {
        req = req.header("x-api-key", api_key.trim());
    }

    let _ = req.send().await;
    Ok(())
}

/// Helper untuk menguji konektivitas ke File API Service.
pub async fn test_storage_api(url: &str, api_key: &str) -> Result<String, String> {
    let base_url = url.trim_end_matches('/');
    let target_url = format!("{base_url}/health");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(&target_url);
    if !api_key.trim().is_empty() {
        req = req.header("x-api-key", api_key.trim());
    }

    let resp = req.send().await.map_err(|e| {
        format!("Gagal menghubungi File API Service di {base_url}: {e}")
    })?;

    if !resp.status().is_success() {
        return Err(format!("File API Service mengembalikan status error: {}", resp.status()));
    }

    #[derive(serde::Deserialize)]
    struct HealthResponse {
        pub status: String,
        #[serde(default)]
        pub service: Option<String>,
        #[serde(default)]
        pub upload_dir: Option<String>,
    }

    let h: HealthResponse = resp.json().await.map_err(|e| format!("Respon healthcheck tidak valid: {e}"))?;
    Ok(format!(
        "File API Service terhubung ({}) - Upload Dir: {}",
        h.service.unwrap_or_else(|| "OK".to_string()),
        h.upload_dir.unwrap_or_default()
    ))
}
