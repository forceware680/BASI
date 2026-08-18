// commands/bukti.rs — upload bukti tunggal + viewer (REQ-04/05).

use crate::models::KoreksiRow;
use sqlx::PgPool;

const MAX_SIZE: u64 = 10 * 1024 * 1024; // 10 MB

fn db_err(e: sqlx::Error) -> String {
    format!("Gagal mengakses data. ({})", e)
}

fn ext_of(path: &str) -> String {
    let name = path.rsplit('/').next().unwrap_or(path).rsplit('\\').next().unwrap_or(path);
    name.rsplit_once('.').map(|(_, e)| e.to_lowercase()).unwrap_or_default()
}

fn mime_of(path: &str) -> Option<&'static str> {
    match ext_of(path).as_str() {
        "pdf" => Some("application/pdf"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        _ => None,
    }
}

/// Upload bukti: validasi → salin ke storage → update record → SELESAI.
pub async fn upload_bukti(
    app: tauri::AppHandle,
    db: &PgPool,
    id: String,
    source_path: String,
) -> Result<KoreksiRow, String> {
    // 1) validasi ekstensi
    let ext = ext_of(&source_path);
    if !["pdf", "jpg", "jpeg", "png"].contains(&ext.as_str()) {
        return Err("Format file harus PDF, JPG, atau PNG.".to_string());
    }
    // 2) validasi ukuran
    let meta = std::fs::metadata(&source_path)
        .map_err(|_| "File tidak ditemukan.".to_string())?;
    if meta.len() > MAX_SIZE {
        return Err("Ukuran file melebihi 10 MB.".to_string());
    }
    // 3) salin ke storage
    let target = crate::storage::copy_bukti(&app, &id, &source_path)
        .map_err(|e| format!("Gagal menyimpan file bukti. Coba lagi. ({e})"))?;
    let target_str = target.to_string_lossy().to_string();
    // 4) hapus file lama jika ada (BR-04)
    let old: (Option<String>,) = sqlx::query_as(
        "SELECT file_path FROM koreksi_bmd WHERE id=$1",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(|_| "Record tidak ditemukan.".to_string())?;
    if let Some(old) = old.0 {
        crate::storage::remove_file(&old);
    }
    // 5) update record
    let mime = mime_of(&source_path).unwrap_or("application/octet-stream").to_string();
    let file_name = std::path::Path::new(&source_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE koreksi_bmd SET file_path=$1, file_name=$2, file_type=$3, uploaded_at=$4, status='SELESAI' WHERE id=$5",
    )
    .bind(&target_str)
    .bind(&file_name)
    .bind(&mime)
    .bind(&now)
    .bind(&id)
    .execute(db)
    .await
    .map_err(db_err)?;
    crate::commands::koreksi::get_koreksi(db, &id).await
}

/// Baca bukti sebagai data URL (viewer). Mengembalikan (mime, data_url).
pub async fn get_bukti_base64(db: &PgPool, id: String) -> Result<(String, String), String> {
    let fp: (Option<String>,) = sqlx::query_as(
        "SELECT file_path FROM koreksi_bmd WHERE id=$1",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(|_| "Record tidak ditemukan.".to_string())?;
    let fp = fp.0.ok_or("Belum ada file bukti.".to_string())?;
    crate::storage::read_bukti_as_data_url(&fp)
        .map_err(|_| "File bukti tidak dapat dibaca.".to_string())
}
