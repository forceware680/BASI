// commands/backup.rs — Backup & Restore Penuh Data + Akun Pengguna + File Bukti (.zip).
// Mendukung pemisahan bersih antara Mode Offline (Lokal) dan Mode Online (Cloud Server).

use crate::models::{KoreksiRow, Opd};
use sqlx::PgPool;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BackupUser {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub full_name: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_login_at: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct BackupPayload {
    version: String,
    created_at: String,
    #[serde(default)]
    users_list: Vec<BackupUser>,
    opd_list: Vec<Opd>,
    koreksi_list: Vec<KoreksiRow>,
}

type DbUserBackupRow = (
    String,         // 0: id
    String,         // 1: username
    String,         // 2: password_hash
    String,         // 3: full_name
    String,         // 4: role
    bool,           // 5: is_active
    String,         // 6: created_at
    Option<String>, // 7: last_login_at
);

fn db_err(e: sqlx::Error) -> String {
    format!("Gagal mengakses database. ({})", e)
}

/// Buat backup .zip berisi database JSON (users, opd, koreksi) + seluruh file scan bukti.
pub async fn create_backup(app: tauri::AppHandle, db: &PgPool) -> Result<Option<String>, String> {
    // 1. Ambil data users dari database yang aktif
    let user_rows: Vec<DbUserBackupRow> = sqlx::query_as(
        "SELECT id::text, username, password_hash, full_name, role, is_active, created_at::text, last_login_at::text FROM users ORDER BY created_at ASC",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let users_list: Vec<BackupUser> = user_rows
        .into_iter()
        .map(|r| BackupUser {
            id: r.0,
            username: r.1,
            password_hash: r.2,
            full_name: r.3,
            role: r.4,
            is_active: r.5,
            created_at: r.6,
            last_login_at: r.7,
        })
        .collect();

    // 2. Ambil data master_opd dari database yang aktif
    let opd_rows = crate::commands::opd::list_opd(db, None).await?;

    // 3. Ambil data koreksi_bmd dari database yang aktif
    let koreksi_list = crate::commands::koreksi::list_koreksi(db, None, None).await?;

    let backup_data = BackupPayload {
        version: "2.1".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        users_list,
        opd_list: opd_rows,
        koreksi_list,
    };

    let json_bytes = serde_json::to_vec_pretty(&backup_data)
        .map_err(|e| format!("Gagal memformat data backup. ({e})"))?;

    // 4. Buka dialog penyimpanan file (.zip) di komputer pengguna
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

    // 5. Tulis file ZIP
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

    // 6. Tangani berkas bukti sesuai MODE AKTIF
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

    // 2. Restore Akun Pengguna (Users) ke database aktif
    if !backup_data.users_list.is_empty() {
        println!("[RESTORE] Memulihkan {} akun pengguna...", backup_data.users_list.len());
        // Hapus check constraint lama jika ada agar peran OPERATOR diizinkan
        let _ = sqlx::query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
            .execute(db)
            .await;

        for u in &backup_data.users_list {
            // Bersihkan potensi konflik username dengan UUID berbeda
            let _ = sqlx::query(
                "DELETE FROM users WHERE lower(trim(username)) = lower(trim($1)) AND id <> $2::uuid",
            )
            .bind(&u.username)
            .bind(&u.id)
            .execute(db)
            .await;

            let created_at_val = if u.created_at.trim().is_empty() {
                chrono::Utc::now().to_rfc3339()
            } else {
                u.created_at.clone()
            };
            let last_login_val = u.last_login_at.as_deref().filter(|s| !s.trim().is_empty());

            let _ = sqlx::query(
                "INSERT INTO users (id, username, password_hash, full_name, role, is_active, created_at, last_login_at)
                 VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
                 ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    password_hash = EXCLUDED.password_hash,
                    full_name = EXCLUDED.full_name,
                    role = EXCLUDED.role,
                    is_active = EXCLUDED.is_active,
                    last_login_at = EXCLUDED.last_login_at",
            )
            .bind(&u.id)
            .bind(&u.username)
            .bind(&u.password_hash)
            .bind(&u.full_name)
            .bind(&u.role)
            .bind(u.is_active)
            .bind(&created_at_val)
            .bind(last_login_val)
            .execute(db)
            .await;
        }
    }

    // 3. Restore Master OPD ke database aktif & buat mapping ID OPD yang aman
    let mut opd_id_map: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();

    for opd in &backup_data.opd_list {
        // Cek apakah OPD dengan nama_opd yang sama sudah ada di DB target
        let existing_opd: Option<(i32,)> = sqlx::query_as(
            "SELECT id FROM master_opd WHERE lower(trim(nama_opd)) = lower(trim($1))"
        )
        .bind(&opd.nama_opd)
        .fetch_optional(db)
        .await
        .unwrap_or(None);

        if let Some((existing_id,)) = existing_opd {
            let _ = sqlx::query(
                "UPDATE master_opd SET singkatan = COALESCE($1, singkatan), is_active = $2 WHERE id = $3"
            )
            .bind(&opd.singkatan)
            .bind(opd.is_active)
            .bind(existing_id)
            .execute(db)
            .await;
            opd_id_map.insert(opd.id, existing_id);
        } else {
            let ins_res = sqlx::query(
                "INSERT INTO master_opd (id, nama_opd, singkatan, is_active)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO UPDATE SET nama_opd = EXCLUDED.nama_opd, singkatan = EXCLUDED.singkatan, is_active = EXCLUDED.is_active",
            )
            .bind(opd.id)
            .bind(&opd.nama_opd)
            .bind(&opd.singkatan)
            .bind(opd.is_active)
            .execute(db)
            .await;

            if ins_res.is_ok() {
                opd_id_map.insert(opd.id, opd.id);
            } else {
                // Fallback insert auto-increment jika ID bentrok
                let auto_res: Option<(i32,)> = sqlx::query_as(
                    "INSERT INTO master_opd (nama_opd, singkatan, is_active) VALUES ($1, $2, $3) RETURNING id"
                )
                .bind(&opd.nama_opd)
                .bind(&opd.singkatan)
                .bind(opd.is_active)
                .fetch_optional(db)
                .await
                .unwrap_or(None);

                if let Some((new_id,)) = auto_res {
                    opd_id_map.insert(opd.id, new_id);
                }
            }
        }
    }

    // Set sequence master_opd_id_seq agar tidak bentrok dengan ID manual
    let _ = sqlx::query("SELECT setval('master_opd_id_seq', COALESCE((SELECT MAX(id)+1 FROM master_opd), 1), false)")
        .execute(db)
        .await;

    // Ambil semua valid user ID di database target untuk verifikasi created_by FK
    let valid_user_ids: std::collections::HashSet<String> = sqlx::query_as::<_, (String,)>(
        "SELECT id::text FROM users"
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| r.0)
    .collect();

    // 4. Restore Koreksi BMD ke database aktif
    let app_dir = crate::storage::app_root(&app)
        .map_err(|e| format!("Gagal mengakses folder data aplikasi. ({e})"))?;
    let bukti_root = app_dir.join("bukti");
    fs::create_dir_all(&bukti_root)
        .map_err(|e| format!("Gagal membuat folder bukti lokal. ({e})"))?;

    let cfg = crate::config::load_config(&app);

    for k in &backup_data.koreksi_list {
        let fname = k.file_name.clone().or_else(|| {
            k.file_path.as_ref().map(|fp| {
                Path::new(&fp.replace('\\', "/"))
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default()
            })
        }).unwrap_or_default();

        let file_path_val = if !fname.is_empty() {
            if cfg.mode == "online" {
                Some(format!("bukti/{}/{}", k.id, fname))
            } else {
                Some(bukti_root.join(&k.id).join(&fname).to_string_lossy().to_string())
            }
        } else {
            None
        };

        // Pemetaan opd_id yang valid
        let target_opd_id = *opd_id_map.get(&k.opd_id).unwrap_or(&k.opd_id);

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

        // Pastikan created_by hanya diisi jika user ID memang terdaftar di tabel users
        let created_by_val = k.created_by.as_deref().filter(|s| {
            !s.trim().is_empty() && valid_user_ids.contains(*s)
        });

        let uploaded_at_val = k.uploaded_at.as_deref().filter(|s| !s.trim().is_empty());
        let file_name_val = if !fname.is_empty() { Some(fname.clone()) } else { k.file_name.clone() };

        sqlx::query(
            "INSERT INTO koreksi_bmd (id, no_tu, no_ba, opd_id, tanggal_surat, penjelasan_koreksi, status, file_path, file_name, file_type, uploaded_at, created_by)
             VALUES ($1::uuid, $2, $3, $4, $5::date, $6, $7::status_tanda_terima, $8, $9, $10, $11::timestamptz, $12::uuid)
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
                uploaded_at = EXCLUDED.uploaded_at,
                created_by = EXCLUDED.created_by",
        )
        .bind(&k.id)
        .bind(&k.no_tu)
        .bind(&k.no_ba)
        .bind(target_opd_id)
        .bind(&k.tanggal_surat)
        .bind(&k.penjelasan_koreksi)
        .bind(k.status.to_db())
        .bind(&file_path_val)
        .bind(&file_name_val)
        .bind(&k.file_type)
        .bind(uploaded_at_val)
        .bind(created_by_val)
        .execute(db)
        .await
        .map_err(db_err)?;
    }

    // 5. Ekstrak seluruh file bukti dari zip ke {app_data_dir}/bukti/
    let mut extracted_files: Vec<(String, std::path::PathBuf)> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(mut zip_file) = archive.by_index(i) {
            let name = zip_file.name().replace('\\', "/");
            if name.starts_with("bukti/") && !name.ends_with('/') {
                let rel = name["bukti/".len()..].to_string();
                let out_path = bukti_root.join(rel.replace('/', "\\"));
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

    // 6. Jika mode online, upload berkas yang baru diekstrak ke File API Service Cloud
    if cfg.mode == "online" && !cfg.storage_api_url.trim().is_empty() {
        println!("[RESTORE] Mengunggah {} berkas hasil pemulihan ke Cloud Server...", extracted_files.len());
        let cache_dir = std::env::temp_dir().join("simbasi_cache");
        let _ = std::fs::create_dir_all(&cache_dir);

        for (rel, path) in extracted_files {
            let rel_norm = rel.replace('\\', "/");
            let parts: Vec<&str> = rel_norm.split('/').filter(|s| !s.is_empty()).collect();
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

    let user_msg = if !backup_data.users_list.is_empty() {
        format!(
            "Berhasil memulihkan {} akun pengguna, {} master OPD, dan {} berkas BA Koreksi.",
            backup_data.users_list.len(),
            backup_data.opd_list.len(),
            backup_data.koreksi_list.len()
        )
    } else {
        format!(
            "Berhasil memulihkan {} master OPD dan {} berkas BA Koreksi.",
            backup_data.opd_list.len(),
            backup_data.koreksi_list.len()
        )
    };

    Ok(Some(user_msg))
}
