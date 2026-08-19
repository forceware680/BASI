// commands/bukti.rs — upload, view, dan hapus bukti tunggal (REQ-04/05).

use crate::models::KoreksiRow;
use sqlx::PgPool;

const MAX_SIZE: u64 = 150 * 1024 * 1024; // 150 MB (Mendukung scan resolusi tinggi & dokumen multi-halaman)

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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ScannerDeviceInfo {
    pub id: String,
    pub name: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
pub struct ScanOptions {
    pub device_id: Option<String>,
    pub source: Option<String>,      // "ADF" | "Flatbed"
    pub dpi: Option<u32>,            // 150 | 300 | 600 | 1200
    pub page_size: Option<String>,   // "A4" | "F4"
    pub color_mode: Option<String>,  // "Color" | "Grayscale" | "BW"
}

/// Mendeteksi daftar perangkat scanner WIA yang terhubung di komputer / LAN.
pub async fn list_scanners() -> Result<Vec<ScannerDeviceInfo>, String> {
    tokio::task::spawn_blocking(|| -> Result<Vec<ScannerDeviceInfo>, String> {
        let ps_code = r#"
try {
    $dm = New-Object -ComObject WIA.DeviceManager
    $list = @()
    foreach ($d in $dm.DeviceInfos) {
        if ($d.Type -eq 1) {
            $name = $d.Properties.Item('Name').Value
            $list += [PSCustomObject]@{ id = $d.DeviceID; name = $name }
        }
    }
    if ($list.Count -gt 0) {
        $list | ConvertTo-Json -Compress
    } else {
        Write-Output "[]"
    }
} catch {
    Write-Output "[]"
}
"#;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps_code]);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = cmd.output().map_err(|e| format!("Gagal mendeteksi scanner: {e}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if stdout.is_empty() || stdout == "[]" {
            return Ok(vec![]);
        }

        if stdout.starts_with('{') {
            if let Ok(single) = serde_json::from_str::<ScannerDeviceInfo>(&stdout) {
                return Ok(vec![single]);
            }
        }

        if let Ok(list) = serde_json::from_str::<Vec<ScannerDeviceInfo>>(&stdout) {
            return Ok(list);
        }

        Ok(vec![])
    })
    .await
    .map_err(|e| format!("Task scanner list gagal: {e}"))?
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
        return Err(format!("Ukuran file ({} MB) melebihi batas maksimal 150 MB.", meta.len() / (1024 * 1024)));
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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct StagedFile {
    pub source_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub file_type: String,
    pub data_url: String,
}

/// Buka pemilih file explorer dan masukkan ke staging (pratinjau sebelum simpan).
pub async fn pick_to_staging() -> Result<Option<StagedFile>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Pilih File Bukti Scan (PDF / JPG / PNG)")
        .add_filter("Dokumen & Gambar (*.pdf, *.jpg, *.png)", &["pdf", "jpg", "jpeg", "png"])
        .pick_file()
        .await;

    match file {
        Some(handle) => {
            let path_str = handle.path().to_string_lossy().to_string();
            let ext = ext_of(&path_str);
            if !["pdf", "jpg", "jpeg", "png"].contains(&ext.as_str()) {
                return Err("Format file harus PDF, JPG, atau PNG.".to_string());
            }
            let meta = std::fs::metadata(&path_str)
                .map_err(|_| "File tidak ditemukan.".to_string())?;
            if meta.len() > MAX_SIZE {
                return Err(format!("Ukuran file ({} MB) melebihi batas maksimal 150 MB.", meta.len() / (1024 * 1024)));
            }
            let (mime, data_url) = crate::storage::read_bukti_as_data_url(&path_str)
                .map_err(|e| format!("Gagal memuat pratinjau berkas: {e}"))?;
            let file_name = std::path::Path::new(&path_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "dokumen".to_string());

            Ok(Some(StagedFile {
                source_path: path_str,
                file_name,
                file_size: meta.len(),
                file_type: mime,
                data_url,
            }))
        }
        None => Ok(None),
    }
}

/// Pindai dari mesin scanner ke staging (pratinjau sebelum disimpan permanen ke database).
pub async fn scan_to_staging(
    options: Option<ScanOptions>,
) -> Result<Option<StagedFile>, String> {
    let opts = options.unwrap_or_default();
    let device_id = opts.device_id.unwrap_or_default();
    let source = opts.source.unwrap_or_else(|| "ADF".to_string());
    let dpi = opts.dpi.unwrap_or(300);
    let page_size = opts.page_size.unwrap_or_else(|| "A4".to_string());
    let color_mode = opts.color_mode.unwrap_or_else(|| "Color".to_string());

    let temp_dir = std::env::temp_dir();
    let scan_file_name = format!("simbasi_staging_{}.jpg", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let output_path = temp_dir.join(&scan_file_name);
    let output_path_str = output_path.to_string_lossy().to_string();

    let output_clone = output_path_str.clone();
    let source_clone = source.clone();
    let page_size_clone = page_size.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<Option<String>, String> {
        let ps_code = format!(
            r#"$ErrorActionPreference = 'Stop';
try {{
    $dialog = New-Object -ComObject WIA.CommonDialog;
    $device = $null;

    $devId = '{device_id}';
    if ($devId) {{
        $devManager = New-Object -ComObject WIA.DeviceManager;
        foreach ($d in $devManager.DeviceInfos) {{
            if ($d.DeviceID -eq $devId) {{
                $device = $d.Connect();
                break;
            }}
        }}
    }}

    if ($null -eq $device) {{
        $devManager = New-Object -ComObject WIA.DeviceManager;
        if ($devManager.DeviceInfos.Count -gt 0) {{
            $device = $devManager.DeviceInfos.Item(1).Connect();
        }}
    }}

    if ($null -eq $device) {{
        $device = $dialog.ShowSelectDevice(1, $true, $false);
    }}

    if ($null -eq $device) {{
        Write-Output 'RESULT:CANCELED';
        exit 0;
    }}

    # 1. Atur Feeder (ADF) vs Flatbed dan baca geometri bed
    # WIA_DPS_DOCUMENT_HANDLING_SELECT (3088): 1=Feeder (ADF), 2=Flatbed (Kaca)
    $source = '{source}';
    $feederReg = 0; # 0=left, 1=center, 2=right
    $bedWidthInches = 8.5;

    foreach ($prop in $device.Properties) {{
        if ($prop.PropertyID -eq 3088) {{
            if ($source -eq 'ADF') {{
                try {{ $prop.Value = 1 }} catch {{}}
            }} else {{
                try {{ $prop.Value = 2 }} catch {{}}
            }}
        }}
        if ($prop.PropertyID -eq 3078) {{
            try {{ $feederReg = [int]$prop.Value }} catch {{}}
        }}
        if ($prop.PropertyID -eq 3076 -or $prop.PropertyID -eq 3074 -or $prop.PropertyID -eq 6165) {{
            try {{
                if ($prop.Value -gt 0) {{
                    $bedWidthInches = [double]$prop.Value / 1000.0;
                }}
            }} catch {{}}
        }}
    }}

    # 2. Atur item properties: DPI, ukuran A4/F4, warna
    $item = $device.Items.Item(1);
    $dpi = {dpi};
    $pageSize = '{page_size}';
    $colorMode = '{color_mode}';

    # Set DPI & Warna terlebih dahulu agar unit extent sinkron
    foreach ($prop in $item.Properties) {{
        if ($prop.PropertyID -eq 6147) {{ try {{ $prop.Value = $dpi }} catch {{}} }}
        if ($prop.PropertyID -eq 6148) {{ try {{ $prop.Value = $dpi }} catch {{}} }}
        if ($prop.PropertyID -eq 6146) {{
            $intent = if ($colorMode -eq 'Grayscale') {{ 2 }} elseif ($colorMode -eq 'BW') {{ 4 }} else {{ 1 }};
            try {{ $prop.Value = $intent }} catch {{}}
        }}
    }}

    # Hitung posisi start dan extent agar tidak terpotong (terutama scanner A3 ADF center-aligned)
    $targetWidthInches = if ($pageSize -eq 'F4') {{ 8.46 }} else {{ 8.27 }};
    $targetHeightInches = if ($pageSize -eq 'F4') {{ 12.99 }} else {{ 11.69 }};

    $xStart = 0;
    if ($source -eq 'ADF' -and $feederReg -eq 1 -and $bedWidthInches -gt $targetWidthInches) {{
        $xStart = [int]((($bedWidthInches - $targetWidthInches) / 2.0) * $dpi);
    }}

    $xExtent = [int]($targetWidthInches * $dpi);
    $yExtent = [int]($targetHeightInches * $dpi);

    foreach ($prop in $item.Properties) {{
        if ($prop.PropertyID -eq 6149) {{ try {{ $prop.Value = $xStart }} catch {{}} }}
        if ($prop.PropertyID -eq 6150) {{ try {{ $prop.Value = 0 }} catch {{}} }}
        if ($prop.PropertyID -eq 6151) {{ try {{ $prop.Value = $xExtent }} catch {{}} }}
        if ($prop.PropertyID -eq 6152) {{ try {{ $prop.Value = $yExtent }} catch {{}} }}
    }}

    # Transfer gambar mentah
    $rawImage = $item.Transfer();

    if ($null -eq $rawImage) {{
        Write-Output 'RESULT:CANCELED';
        exit 0;
    }}

    # Konversi ke JPEG asli teroptimasi berkualitas tinggi (Quality: 88%)
    try {{
        $ip = New-Object -ComObject WIA.ImageProcess;
        $ip.Filters.Add($ip.FilterInfos.Item('Convert').FilterID);
        $ip.Filters.Item(1).Properties.Item('FormatID').Value = '{{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}}'; # JPEG
        $ip.Filters.Item(1).Properties.Item('Quality').Value = 88;
        $finalImage = $ip.Apply($rawImage);
    }} catch {{
        $finalImage = $rawImage;
    }}

    $out = '{output}';
    if (Test-Path $out) {{ Remove-Item -Force $out }};
    $finalImage.SaveFile($out);
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
            device_id = device_id.replace('\\', "\\\\").replace('\'', "''"),
            source = source,
            dpi = dpi,
            page_size = page_size,
            color_mode = color_mode,
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
            let (mime, data_url) = crate::storage::read_bukti_as_data_url(&scanned_path)
                .map_err(|e| format!("Gagal memuat pratinjau hasil scan: {e}"))?;
            let meta = std::fs::metadata(&scanned_path)
                .map_err(|_| "Gagal membaca metadata file hasil scan.".to_string())?;

            let file_name = format!("Scan_{}_{}DPI_{}.jpg", source_clone, dpi, page_size_clone);

            Ok(Some(StagedFile {
                source_path: scanned_path,
                file_name,
                file_size: meta.len(),
                file_type: mime,
                data_url,
            }))
        }
        None => Ok(None),
    }
}

/// Native file picker + upload bukti langsung.
#[allow(dead_code)]
pub async fn pick_and_upload_bukti(
    app: tauri::AppHandle,
    db: &PgPool,
    id: String,
) -> Result<Option<KoreksiRow>, String> {
    if let Some(staged) = pick_to_staging().await? {
        let row = upload_bukti(app, db, id, staged.source_path).await?;
        Ok(Some(row))
    } else {
        Ok(None)
    }
}

/// Pindai langsung dari mesin scanner (WIA Windows Image Acquisition) dan upload langsung.
pub async fn scan_and_upload_bukti(
    app: tauri::AppHandle,
    db: &PgPool,
    id: String,
    options: Option<ScanOptions>,
) -> Result<Option<KoreksiRow>, String> {
    if let Some(staged) = scan_to_staging(options).await? {
        let row = upload_bukti(app, db, id, staged.source_path.clone()).await?;
        let _ = std::fs::remove_file(&staged.source_path);
        Ok(Some(row))
    } else {
        Ok(None)
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
