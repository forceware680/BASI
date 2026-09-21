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
        .map_err(|e| format!("Gagal menulis data JSON. ({e})"))?;    let cfg = crate::config::load_config(&app);

    // 6. Kumpulkan dan tambahkan SELURUH file bukti (PDF/Gambar) ke dalam ZIP
    let mut added_entries = std::collections::HashSet::<String>::new();
    let mut backed_up_files_count = 0;

    let app_dir_opt = crate::storage::app_root(&app).ok();
    let temp_cache_dir = std::env::temp_dir().join("simbasi_cache");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    for k in &backup_data.koreksi_list {
        // Ambil nama file dari file_path atau file_name
        let stored_fname = k.file_path.as_ref().and_then(|fp| {
            let fp_norm = fp.replace('\\', "/");
            let name = Path::new(&fp_norm).file_name()?.to_str()?.to_string();
            if !name.is_empty() { Some(name) } else { None }
        }).or_else(|| k.file_name.clone()).unwrap_or_default();

        let mut found_for_this_koreksi = false;

        // 1. Coba baca seluruh berkas yang ada di folder bukti AppData lokal untuk koreksi ID ini: %APPDATA%/bukti/{k.id}/
        if let Some(ref app_dir) = app_dir_opt {
            let k_dir = app_dir.join("bukti").join(&k.id);
            if k_dir.is_dir() {
                if let Ok(entries) = fs::read_dir(&k_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() {
                            let entry_fname = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                            if !entry_fname.is_empty() {
                                let entry_name = format!("bukti/{}/{}", k.id, entry_fname);
                                if !added_entries.contains(&entry_name) {
                                    if let Ok(b) = fs::read(&path) {
                                        if zip.start_file(&entry_name, options).is_ok() && zip.write_all(&b).is_ok() {
                                            added_entries.insert(entry_name.clone());
                                            backed_up_files_count += 1;
                                            found_for_this_koreksi = true;
                                            println!("[BACKUP] Berhasil menambahkan file bukti lokal: {} ({} bytes)", entry_name, b.len());
                                        }
                                    }
                                } else {
                                    found_for_this_koreksi = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        if found_for_this_koreksi || stored_fname.is_empty() {
            continue;
        }

        let zip_entry_name = format!("bukti/{}/{}", k.id, stored_fname);
        if added_entries.contains(&zip_entry_name) {
            continue;
        }

        let mut file_bytes: Option<Vec<u8>> = None;

        // 2. Coba baca langsung dari k.file_path jika merupakan path absolut lokal yang valid
        if let Some(ref fp) = k.file_path {
            let p = Path::new(fp);
            if p.is_absolute() && p.exists() {
                if let Ok(b) = fs::read(p) {
                    file_bytes = Some(b);
                }
            }
        }

        // 3. Coba baca dari folder cache lokal simbasi_cache
        if file_bytes.is_none() {
            let cached_file = temp_cache_dir.join(format!("{}_{}", k.id, stored_fname));
            if cached_file.exists() {
                if let Ok(b) = fs::read(&cached_file) {
                    file_bytes = Some(b);
                }
            }
        }

        // 4. Jika belum ditemukan dan server File API dikonfigurasi, unduh dari Cloud
        if file_bytes.is_none() && !cfg.storage_api_url.trim().is_empty() {
            let base_url = cfg.storage_api_url.trim_end_matches('/');
            let download_url = format!("{base_url}/api/bukti/{}/{}", k.id, stored_fname);

            let mut req = client.get(&download_url);
            if !cfg.storage_api_key.trim().is_empty() {
                req = req.header("x-api-key", cfg.storage_api_key.trim());
            }

            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        file_bytes = Some(bytes.to_vec());
                    }
                }
            }
        }

        // Masukkan file ke zip jika bytes ditemukan
        if let Some(bytes) = file_bytes {
            if zip.start_file(&zip_entry_name, options).is_ok() && zip.write_all(&bytes).is_ok() {
                added_entries.insert(zip_entry_name.clone());
                backed_up_files_count += 1;
                println!("[BACKUP] Berhasil menambahkan file bukti dari cache/cloud: {} ({} bytes)", zip_entry_name, bytes.len());
            }
        }
    }

    // 7. Salin juga seluruh sisa file di folder %APPDATA%/bukti jika ada file yang belum terindeks
    if let Some(ref app_dir) = app_dir_opt {
        let bukti_dir = app_dir.join("bukti");
        if bukti_dir.exists() {
            add_dir_to_zip(&mut zip, &bukti_dir, &bukti_dir, options, &mut added_entries)?;
        }
    }

    println!("[BACKUP] Selesai menambahkan {} berkas scan bukti ke dalam file arsip.", backed_up_files_count);

    zip.finish()
        .map_err(|e| format!("Gagal menyelesaikan pembuatan arsip backup. ({e})"))?;

    let summary_msg = format!(
        "{}\n(Memuat {} akun pengguna, {} master OPD, {} data BA Koreksi, dan {} berkas fisik scan bukti)",
        target_path.to_string_lossy(),
        backup_data.users_list.len(),
        backup_data.opd_list.len(),
        backup_data.koreksi_list.len(),
        backed_up_files_count
    );

    Ok(Some(summary_msg))
}

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    base_dir: &Path,
    current_dir: &Path,
    options: SimpleFileOptions,
    added_entries: &mut std::collections::HashSet<String>,
) -> Result<(), String> {
    if let Ok(entries) = fs::read_dir(current_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                add_dir_to_zip(zip, base_dir, &path, options, added_entries)?;
            } else if path.is_file() {
                if let Ok(rel_path) = path.strip_prefix(base_dir) {
                    let zip_entry_name = format!("bukti/{}", rel_path.to_string_lossy().replace('\\', "/"));
                    if !added_entries.contains(&zip_entry_name) {
                        if let Ok(mut f) = File::open(&path) {
                            let mut buffer = Vec::new();
                            if f.read_to_end(&mut buffer).is_ok() {
                                let _ = zip.start_file(&zip_entry_name, options);
                                let _ = zip.write_all(&buffer);
                                added_entries.insert(zip_entry_name);
                            }
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
                }
            }
        }
    }
    drop(archive);

    // Nama file kanonik per koreksi dari data.json (sumber acuan viewer/DB).
    let canonical_fname = |k: &KoreksiRow| -> Option<String> {
        k.file_name
            .as_deref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .and_then(|s| {
                Path::new(&s)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .filter(|n| !n.is_empty())
            })
    };

    // 5b. Normalisasi nama file fisik agar identik dengan file_name di database.
    // Arsip backup menyimpan file dengan NAMA PENYIMPANAN (mis. {timestamp}_{nama}
    // dari server File API), sedangkan database memakai nama asli (file_name).
    // Jika tidak disamakan, viewer tidak menemukan file dan gagal dengan
    // "The system cannot find the file specified" (os error 2) saat restore ke lokal/offline.
    for k in &backup_data.koreksi_list {
        let Some(fname) = canonical_fname(k) else {
            continue;
        };
        let k_dir = bukti_root.join(&k.id);
        let target = k_dir.join(&fname);
        if target.exists() {
            continue;
        }
        // 1) Prioritas: file yang persis nama referensinya ada di data.json (file_path).
        // 2) Fallback: file terbaru di folder koreksi ini.
        let stored_fname = k
            .file_path
            .as_deref()
            .map(|fp| {
                Path::new(&fp.replace('\\', "/"))
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
            })
            .flatten()
            .filter(|n| !n.is_empty());
        let source = stored_fname
            .map(|n| k_dir.join(&n))
            .filter(|p| p.exists())
            .or_else(|| {
                fs::read_dir(&k_dir)
                    .map(|entries| {
                        entries
                            .flatten()
                            .filter(|e| e.path().is_file())
                            .filter_map(|e| e.metadata().ok().and_then(|m| m.modified().ok()).map(|t| (t, e.path())))
                            .into_iter()
                            .max_by_key(|(t, _)| *t)
                            .map(|(_, p)| p)
                    })
                    .unwrap_or(None)
            });
        if let Some(source) = source {
            if fs::rename(&source, &target).is_ok() {
                println!(
                    "[RESTORE] Normalisasi nama file: {} -> {}",
                    source.to_string_lossy(),
                    target.to_string_lossy()
                );
            }
        }
    }

    // 6. Jika mode online, upload berkas yang sudah dinormalisasi ke File API Service Cloud
    if cfg.mode == "online" && !cfg.storage_api_url.trim().is_empty() {
        let cache_dir = std::env::temp_dir().join("simbasi_cache");
        let _ = std::fs::create_dir_all(&cache_dir);
        let mut uploaded_count = 0;

        for k in &backup_data.koreksi_list {
            let Some(fname) = canonical_fname(k) else {
                continue;
            };
            let path = bukti_root.join(&k.id).join(&fname);
            if !path.exists() {
                continue;
            }

            // Simpan juga ke cache lokal dengan nama yang sama dengan di database
            let _ = std::fs::copy(&path, cache_dir.join(format!("{}_{}", k.id, fname)));

            match crate::storage::upload_to_remote_exact(
                &cfg.storage_api_url,
                &cfg.storage_api_key,
                &k.id,
                &path.to_string_lossy(),
            )
            .await {
                Ok((remote_path, f_up, ftype)) => {
                    uploaded_count += 1;
                    println!("[RESTORE] Sukses mengunggah berkas: {}", remote_path);
                    let _ = sqlx::query(
                        "UPDATE koreksi_bmd SET file_path = $1, file_name = $2, file_type = $3 WHERE id = $4::uuid",
                    )
                    .bind(&remote_path)
                    .bind(&f_up)
                    .bind(&ftype)
                    .bind(&k.id)
                    .execute(db)
                    .await;
                }
                Err(e) => {
                    eprintln!("[RESTORE ERROR] Gagal mengunggah berkas {}: {}", fname, e);
                }
            }
        }
        println!("[RESTORE] Mengunggah {} berkas hasil pemulihan ke Cloud Server.", uploaded_count);
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
