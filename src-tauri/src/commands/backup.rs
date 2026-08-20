// commands/backup.rs — Backup & Restore Penuh Data + File Bukti (.zip).
// Mendukung pemisahan bersih antara Mode Offline (Lokal) dan Mode Online (Cloud Server).

use crate::models::{KoreksiRow, Opd};
use sqlx::PgPool;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(serde::Serialize, serde::Deserialize)]
struct BackupPayload {
    version: String,
    created_at: String,
    opd_list: Vec<Opd>,
    koreksi_list: Vec<KoreksiRow>,
}

fn db_err(e: sqlx::Error) -> String {
    format!("Gagal mengakses database. ({})", e)
}

/// Buat backup .zip berisi database JSON + seluruh file scan bukti.
pub async fn create_backup(app: tauri::AppHandle, db: &PgPool) -> Result<Option<String>, String> {
    // 1. Ambil data master_opd dari database yang aktif
    let opd_rows = crate::commands::opd::list_opd(db, None).await?;

    // 2. Ambil data koreksi_bmd dari database yang aktif
    let koreksi_list = crate::commands::koreksi::list_koreksi(db, None, None).await?;

    let backup_data = BackupPayload {
        version: "2.0".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        opd_list: opd_rows,
        koreksi_list,
    };

    let json_bytes = serde_json::to_vec_pretty(&backup_data)
        .map_err(|e| format!("Gagal memformat data backup. ({e})"))?;

    // 3. Buka dialog penyimpanan file (.zip) di komputer pengguna
    let default_name = format!(
        "backup_sim_ba_koreksi_{}.zip",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );

    let save_dialog = rfd::AsyncFileDialog::new()
        .set_title("Simpan File Cadangan / Backup (.zip)")
        .set_file_name(&default_name)
        .add_filter("SIM-BA Backup Archive (*.zip)", &["zip"])
        .save_file()
        .await;

    let target_path = match save_dialog {
        Some(handle) => handle.path().to_path_buf(),
        None => return Ok(None), // User batal
    };

    // 4. Tulis file ZIP
    let file = File::create(&target_path)
        .map_err(|e| format!("Gagal membuat file backup di lokasi tujuan. ({e})"))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // Tulis data.json ke dalam zip
    zip.start_file("data.json", options)
        .map_err(|e| format!("Gagal menambahkan data ke arsip. ({e})"))?;
    zip.write_all(&json_bytes)
        .map_err(|e| format!("Gagal menulis data JSON. ({e})"))?;

    let cfg = crate::config::load_config(&app);

    // 5. Tangani berkas bukti sesuai MODE AKTIF
    if cfg.mode == "offline" {
        // MODE OFFLINE: Ambil file bukti fisik dari folder %APPDATA%/bukti/ komputer lokal
        println!("[BACKUP] Mode Offline: Mengambil berkas bukti dari folder lokal...");
        if let Ok(app_dir) = crate::storage::app_root(&app) {
            let bukti_dir = app_dir.join("bukti");
            if bukti_dir.exists() {
                add_dir_to_zip(&mut zip, &bukti_dir, &bukti_dir, options)?;
            }
        }
    } else if !cfg.storage_api_url.trim().is_empty() {
        // MODE ONLINE: Unduh seluruh berkas bukti fisik dari File API Service Cloud ke dalam ZIP
        let base_url = cfg.storage_api_url.trim_end_matches('/');
        let client = reqwest::Client::new();
        println!("[BACKUP] Mode Online: Mengunduh berkas scan dari server Cloud: {}", base_url);

        let mut downloaded_count = 0;
        for k in &backup_data.koreksi_list {
            if let Some(ref fp) = k.file_path {
                let fp_norm = fp.replace('\\', "/");
                let fname = Path::new(&fp_norm)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                if !fname.is_empty() {
                    let k_id = &k.id;
                    let zip_entry_name = format!("bukti/{k_id}/{fname}");
                    let download_url = format!("{base_url}/api/bukti/{k_id}/{fname}");

                    let mut req = client.get(&download_url);
                    if !cfg.storage_api_key.trim().is_empty() {
                        req = req.header("x-api-key", cfg.storage_api_key.trim());
                    }

                    match req.send().await {
                        Ok(resp) => {
                            if resp.status().is_success() {
                                if let Ok(bytes) = resp.bytes().await {
                                    if zip.start_file(&zip_entry_name, options).is_ok()
                                        && zip.write_all(&bytes).is_ok()
                                    {
                                        downloaded_count += 1;
                                        println!(
                                            "[BACKUP] Berhasil mengunduh & menambahkan: {} ({} bytes)",
                                            zip_entry_name,
                                            bytes.len()
                                        );
                                    }
                                }
                            } else {
                                eprintln!(
                                    "[BACKUP WARN] File API mengembalikan status {}: {}",
                                    resp.status(),
                                    download_url
                                );
                            }
                        }
                        Err(e) => {
                            eprintln!("[BACKUP ERROR] Gagal mengunduh {}: {}", download_url, e);
                        }
                    }
                }
            }
        }
        println!("[BACKUP] Selesai mengunduh {} berkas dari Cloud Server.", downloaded_count);
    }

    zip.finish()
        .map_err(|e| format!("Gagal menyelesaikan pembuatan arsip backup. ({e})"))?;

    Ok(Some(target_path.to_string_lossy().to_string()))
}

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    base_dir: &Path,
    current_dir: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    if let Ok(entries) = fs::read_dir(current_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                add_dir_to_zip(zip, base_dir, &path, options)?;
            } else if path.is_file() {
                if let Ok(rel_path) = path.strip_prefix(base_dir) {
                    let zip_entry_name = format!("bukti/{}", rel_path.to_string_lossy().replace('\\', "/"));
                    if let Ok(mut f) = File::open(&path) {
                        let mut buffer = Vec::new();
                        if f.read_to_end(&mut buffer).is_ok() {
                            let _ = zip.start_file(zip_entry_name, options);
                            let _ = zip.write_all(&buffer);
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

/// Pulihkan database dan berkas bukti dari file backup .zip
pub async fn restore_backup(app: tauri::AppHandle, db: &PgPool) -> Result<Option<String>, String> {
    let file_dialog = rfd::AsyncFileDialog::new()
        .set_title("Pilih File Cadangan / Backup (.zip) untuk Dipulihkan")
        .add_filter("SIM-BA Backup Archive (*.zip)", &["zip"])
        .pick_file()
        .await;

    let source_path = match file_dialog {
        Some(handle) => handle.path().to_path_buf(),
        None => return Ok(None),
    };

    let file = File::open(&source_path)
        .map_err(|e| format!("Gagal membuka file backup terpilih. ({e})"))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Format file arsip backup tidak valid. ({e})"))?;

    // 1. Baca data.json lalu drop data_file agar archive bisa dibaca ulang
    let json_content = {
        let mut data_file = archive
            .by_name("data.json")
            .map_err(|_| "File backup tidak memuat 'data.json' yang valid.".to_string())?;

        let mut content = String::new();
        data_file
            .read_to_string(&mut content)
            .map_err(|e| format!("Gagal membaca data backup JSON. ({e})"))?;
        content
    };

    let backup_data: BackupPayload = serde_json::from_str(&json_content)
        .map_err(|e| format!("Format data JSON tidak cocok. ({e})"))?;

    // 2. Restore Master OPD ke database aktif
    for opd in &backup_data.opd_list {
        sqlx::query(
            "INSERT INTO master_opd (id, nama_opd, singkatan, is_active)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET nama_opd = EXCLUDED.nama_opd, singkatan = EXCLUDED.singkatan, is_active = EXCLUDED.is_active",
        )
        .bind(opd.id)
        .bind(&opd.nama_opd)
        .bind(&opd.singkatan)
        .bind(opd.is_active)
        .execute(db)
        .await
        .map_err(db_err)?;
    }

    // Set sequence master_opd_id_seq agar tidak bentrok
    let _ = sqlx::query("SELECT setval('master_opd_id_seq', COALESCE((SELECT MAX(id)+1 FROM master_opd), 1), false)")
        .execute(db)
        .await;

    // 3. Restore Koreksi BMD ke database aktif
    let app_dir = crate::storage::app_root(&app)
        .map_err(|e| format!("Gagal mengakses folder data aplikasi. ({e})"))?;
    let bukti_root = app_dir.join("bukti");
    fs::create_dir_all(&bukti_root)
        .map_err(|e| format!("Gagal membuat folder bukti lokal. ({e})"))?;

    let cfg = crate::config::load_config(&app);

    for k in &backup_data.koreksi_list {
        let file_path_val = if let Some(ref fp_old) = k.file_path {
            let fp_norm = fp_old.replace('\\', "/");
            let fname = Path::new(&fp_norm)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            if !fname.is_empty() {
                if cfg.mode == "online" {
                    Some(format!("bukti/{}/{}", k.id, fname))
                } else {
                    Some(bukti_root.join(&k.id).join(&fname).to_string_lossy().to_string())
                }
            } else {
                None
            }
        } else {
            None
        };

        // Bersihkan data lama di database target yang memiliki No BA atau No TU yang sama
        // namun berbeda ID UUID agar tidak melanggar unique constraint idx_koreksi_no_tu_unique / idx_koreksi_no_ba_unique
        let _ = sqlx::query(
            "DELETE FROM koreksi_bmd
             WHERE (lower(trim(no_ba)) = lower(trim($1)) OR lower(trim(no_tu)) = lower(trim($2)))
               AND id <> $3::uuid",
        )
        .bind(&k.no_ba)
        .bind(&k.no_tu)
        .bind(&k.id)
        .execute(db)
        .await;

        sqlx::query(
            "INSERT INTO koreksi_bmd (id, no_tu, no_ba, opd_id, tanggal_surat, penjelasan_koreksi, status, file_path, file_name, file_type, uploaded_at)
             VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7::status_tanda_terima, $8, $9, $10, $11::timestamptz)
             ON CONFLICT (id) DO UPDATE SET
                no_tu = EXCLUDED.no_tu,
                no_ba = EXCLUDED.no_ba,
                opd_id = EXCLUDED.opd_id,
                tanggal_surat = EXCLUDED.tanggal_surat,
                penjelasan_koreksi = EXCLUDED.penjelasan_koreksi,
                status = EXCLUDED.status,
                file_path = EXCLUDED.file_path,
                file_name = EXCLUDED.file_name,
                file_type = EXCLUDED.file_type,
                uploaded_at = EXCLUDED.uploaded_at",
        )
        .bind(&k.id)
        .bind(&k.no_tu)
        .bind(&k.no_ba)
        .bind(k.opd_id)
        .bind(&k.tanggal_surat)
        .bind(&k.penjelasan_koreksi)
        .bind(k.status.to_db())
        .bind(&file_path_val)
        .bind(&k.file_name)
        .bind(&k.file_type)
        .bind(&k.uploaded_at)
        .execute(db)
        .await
        .map_err(db_err)?;
    }

    // 4. Ekstrak seluruh file bukti dari zip ke {app_data_dir}/bukti/
    let mut extracted_files: Vec<(String, std::path::PathBuf)> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(mut zip_file) = archive.by_index(i) {
            let name = zip_file.name().to_string();
            if name.starts_with("bukti/") && !name.ends_with('/') {
                let rel = name["bukti/".len()..].to_string();
                let out_path = bukti_root.join(&rel);
                if let Some(parent) = out_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                if let Ok(mut outfile) = File::create(&out_path) {
                    let _ = std::io::copy(&mut zip_file, &mut outfile);
                    extracted_files.push((rel, out_path));
                }
            }
        }
    }
    drop(archive);

    // 5. Jika mode online, upload berkas yang baru diekstrak ke File API Service Cloud
    if cfg.mode == "online" && !cfg.storage_api_url.trim().is_empty() {
        println!("[RESTORE] Mengunggah berkas-berkas hasil pemulihan ke Cloud Server...");
        let cache_dir = std::env::temp_dir().join("simbasi_cache");
        let _ = std::fs::create_dir_all(&cache_dir);

        for (rel, path) in extracted_files {
            let rel_norm = rel.replace('\\', "/");
            let parts: Vec<&str> = rel_norm.split('/').collect();
            if parts.len() >= 2 {
                let k_id = parts[0];
                let orig_fname = parts[1];

                // Simpan juga ke cache lokal
                let _ = std::fs::copy(&path, cache_dir.join(format!("{}_{}", k_id, orig_fname)));

                match crate::storage::upload_to_remote_exact(
                    &cfg.storage_api_url,
                    &cfg.storage_api_key,
                    k_id,
                    &path.to_string_lossy(),
                )
                .await {
                    Ok((remote_path, fname, ftype)) => {
                        println!("[RESTORE] Sukses mengunggah berkas: {}", remote_path);
                        let _ = sqlx::query(
                            "UPDATE koreksi_bmd SET file_path = $1, file_name = $2, file_type = $3 WHERE id = $4::uuid",
                        )
                        .bind(&remote_path)
                        .bind(&fname)
                        .bind(&ftype)
                        .bind(k_id)
                        .execute(db)
                        .await;
                    }
                    Err(e) => {
                        eprintln!("[RESTORE ERROR] Gagal mengunggah berkas {}: {}", orig_fname, e);
                    }
                }
            }
        }
    }

    Ok(Some(format!(
        "Berhasil memulihkan {} master OPD dan {} berkas BA Koreksi.",
        backup_data.opd_list.len(),
        backup_data.koreksi_list.len()
    )))
}
