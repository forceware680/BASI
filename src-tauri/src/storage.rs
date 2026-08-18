// storage.rs — kelola file bukti di {app_data_dir}/bukti/{koreksi_id}/.
//
// Kepemilikan file ada pada aplikasi: file ASAL user DISALIN (NFR-04).
// Tidak pernah menyimpan path ke lokasi asal user.

use std::fs;
use std::path::PathBuf;
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

/// Folder bukti untuk satu koreksi: {app_data_dir}/bukti/{koreksi_id}
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
    let base = std::path::Path::new(source);
    let name = base
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "bukti".to_string());
    let target = dir.join(format!("{}_{}", ts, sanitize(&name)));
    fs::copy(source, &target)?;
    Ok(target)
}

/// Hapus file bukti lama dari storage.
pub fn remove_file(path: &str) {
    let _ = fs::remove_file(path);
}

/// Baca file bukti → (mime, data_url) untuk viewer.
pub fn read_bukti_as_data_url(path: &str) -> std::io::Result<(String, String)> {
    let bytes = fs::read(path)?;
    let mime = if path.ends_with(".pdf") {
        "application/pdf"
    } else if path.ends_with(".png") {
        "image/png"
    } else {
        "image/jpeg"
    };
    let encoded = base64::encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime, encoded);
    Ok((mime.to_string(), data_url))
}
