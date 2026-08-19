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
    println!("[BUKTI] Berhasil mengunggah file bukti: '{}' (ID: {}). Status menjadi SELESAI.", file_name, id);
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

/// Pindai langsung dari mesin scanner (WIA Windows Image Acquisition) dan upload bukti.
pub async fn scan_and_upload_bukti(
    app: tauri::AppHandle,
    db: &PgPool,
    id: String,
) -> Result<Option<KoreksiRow>, String> {
    let temp_dir = std::env::temp_dir();
    let scan_file_name = format!("simbasi_scan_{}.jpg", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let output_path = temp_dir.join(&scan_file_name);
    let output_path_str = output_path.to_string_lossy().to_string();

    let output_clone = output_path_str.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<Option<String>, String> {
        let ps_code = format!(
            r#"$ErrorActionPreference = 'Stop';
try {{
    $dialog = New-Object -ComObject WIA.CommonDialog;
    $image = $dialog.ShowAcquireImage(1, 0, 131072, '{{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}}', $false, $true, $true);
    if ($null -eq $image) {{
        Write-Output 'RESULT:CANCELED';
        exit 0;
    }}
    $out = '{output}';
    if (Test-Path $out) {{ Remove-Item -Force $out }};
    $image.SaveFile($out);
    Write-Output "RESULT:SUCCESS:$out";
}} catch {{
    $hresult = $_.Exception.HResult;
    if ($hresult -eq -2145320860 -or $_.Exception.Message -match '0x80210064' -or $_.Exception.Message -match 'cancel') {{
        Write-Output 'RESULT:CANCELED';
    }} elseif ($hresult -eq -2145320939 -or $_.Exception.Message -match '0x80210015' -or $_.Exception.Message -match 'offline') {{
        Write-Output 'RESULT:ERROR:Perangkat scanner tidak terdeteksi atau offline. Pastikan scanner sudah terhubung dan menyala.';
    }} elseif ($hresult -eq -2145320954 -or $_.Exception.Message -match '0x80210006' -or $_.Exception.Message -match 'busy') {{
        Write-Output 'RESULT:ERROR:Perangkat scanner sedang sibuk digunakan oleh aplikasi lain.';
    }} else {{
        Write-Output "RESULT:ERROR:$($_.Exception.Message)";
    }}
}}"#,
            output = output_clone.replace('\\', "\\\\").replace('\'', "''")
        );

        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &ps_code]);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = cmd.output().map_err(|e| format!("Gagal menjalankan proses pemindaian: {e}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        for line in stdout.lines() {
            let line = line.trim();
            if line.starts_with("RESULT:SUCCESS:") {
                let path = line.strip_prefix("RESULT:SUCCESS:").unwrap_or("").trim().to_string();
                return Ok(Some(path));
            } else if line == "RESULT:CANCELED" {
                return Ok(None);
            } else if line.starts_with("RESULT:ERROR:") {
                let err_msg = line.strip_prefix("RESULT:ERROR:").unwrap_or("Gagal memindai.").trim().to_string();
                return Err(err_msg);
            }
        }

        if !std::path::Path::new(&output_clone).exists() {
            return Err("Pemindaian dibatalkan atau tidak menghasilkan berkas gambar.".to_string());
        }

        Ok(Some(output_clone))
    })
    .await
    .map_err(|e| format!("Task scanning gagal: {e}"))??;

    match result {
        Some(scanned_path) => {
            let row = upload_bukti(app, db, id, scanned_path.clone()).await?;
            let _ = std::fs::remove_file(scanned_path);
            Ok(Some(row))
        }
        None => Ok(None),
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

    println!("[BUKTI] Berhasil menghapus file bukti (ID: {}). Status dikembalikan ke MENUNGGU_BUKTI.", id);
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
