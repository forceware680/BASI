// commands/bukti.rs — upload, view, dan hapus bukti tunggal (REQ-04/05).

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
        "SELECT file_path FROM koreksi_bmd WHERE id=$1::uuid",
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
        "UPDATE koreksi_bmd SET file_path=$1, file_name=$2, file_type=$3, uploaded_at=$4::timestamptz, status='SELESAI' WHERE id=$5::uuid",
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

/// Native file picker + upload bukti (langsung membuka Windows native dialog tanpa hambatan izin JS).
#[allow(dead_code)]
pub async fn pick_and_upload_bukti(
    app: tauri::AppHandle,
    db: &PgPool,
    id: String,
) -> Result<Option<KoreksiRow>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Pilih File Bukti Scan (PDF / JPG / PNG)")
        .add_filter("Dokumen & Gambar (*.pdf, *.jpg, *.png)", &["pdf", "jpg", "jpeg", "png"])
        .pick_file()
        .await;

    match file {
        Some(handle) => {
            let path_str = handle.path().to_string_lossy().to_string();
            let row = upload_bukti(app, db, id, path_str).await?;
            Ok(Some(row))
        }
        None => Ok(None), // User membatalkan pemilihan file
    }
}

/// Hapus file bukti scan: hapus file fisik di storage, kosongkan kolom file di DB,
/// dan kembalikan status tanda terima menjadi MENUNGGU_BUKTI.
pub async fn delete_bukti(db: &PgPool, id: String) -> Result<KoreksiRow, String> {
    let old: (Option<String>,) = sqlx::query_as(
        "SELECT file_path FROM koreksi_bmd WHERE id=$1::uuid",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(|_| "Record tidak ditemukan.".to_string())?;

    if let Some(old_path) = old.0 {
        crate::storage::remove_file(&old_path);
    }

    sqlx::query(
        "UPDATE koreksi_bmd SET file_path=NULL, file_name=NULL, file_type=NULL, uploaded_at=NULL, status='MENUNGGU_BUKTI' WHERE id=$1::uuid",
    )
    .bind(&id)
    .execute(db)
    .await
    .map_err(db_err)?;

    crate::commands::koreksi::get_koreksi(db, &id).await
}

/// Baca bukti sebagai data URL (viewer). Mengembalikan (mime, data_url).
pub async fn get_bukti_base64(db: &PgPool, id: String) -> Result<(String, String), String> {
    let fp: (Option<String>,) = sqlx::query_as(
        "SELECT file_path FROM koreksi_bmd WHERE id=$1::uuid",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(|_| "Record tidak ditemukan.".to_string())?;
    let fp = fp.0.ok_or("Belum ada file bukti.".to_string())?;
    crate::storage::read_bukti_as_data_url(&fp)
        .map_err(|_| "File bukti tidak dapat dibaca.".to_string())
}
