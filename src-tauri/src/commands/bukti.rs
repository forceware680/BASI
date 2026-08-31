// commands/bukti.rs — upload, view, dan hapus bukti tunggal (REQ-04/05).

use crate::models::KoreksiRow;
use base64::Engine;
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
    pub source: Option<String>,         // "ADF" | "Flatbed"
    pub dpi: Option<u32>,               // 150 | 300 | 600 | 1200
    pub page_size: Option<String>,      // "A4" | "F4"
    pub color_mode: Option<String>,     // "Color" | "Grayscale" | "BW"
    pub output_format: Option<String>,  // "PDF" | "JPG"
}

fn extract_jpeg_dimensions(data: &[u8]) -> Option<(u32, u32, bool)> {
    let mut i = 0;
    while i < data.len().saturating_sub(8) {
        if data[i] == 0xFF {
            let marker = data[i + 1];
            // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
            if marker == 0xC0 || marker == 0xC1 || marker == 0xC2 {
                let h = ((data[i + 5] as u32) << 8) | (data[i + 6] as u32);
                let w = ((data[i + 7] as u32) << 8) | (data[i + 8] as u32);
                let components = if i + 9 < data.len() { data[i + 9] } else { 3 };
                return Some((w, h, components == 1));
            }
            if marker == 0xD8 || marker == 0xD9 {
                i += 2;
                continue;
            }
            if i + 3 < data.len() {
                let len = ((data[i + 2] as usize) << 8) | (data[i + 3] as usize);
                i += 2 + len;
                continue;
            }
        }
        i += 1;
    }
    None
}

/// Membungkus gambar JPEG pindaian menjadi dokumen PDF 1.4 resmi standar tanpa re-encode.
pub fn wrap_jpeg_as_pdf(
    jpeg_bytes: &[u8],
    page_size: &str,
) -> Result<Vec<u8>, String> {
    let (page_w, page_h) = if page_size == "F4" {
        (612.0f32, 936.0f32)
    } else {
        (595.28f32, 841.89f32) // A4 standar (210 x 297 mm)
    };

    let (img_w, img_h, is_gray) = extract_jpeg_dimensions(jpeg_bytes)
        .unwrap_or((2480, 3508, false));

    let colorspace = if is_gray { "DeviceGray" } else { "DeviceRGB" };
    let content_stream = format!(
        "q\n{:.2} 0 0 {:.2} 0 0 cm\n/Im0 Do\nQ\n",
        page_w, page_h
    );

    let mut pdf = Vec::new();
    let mut offsets = Vec::new();

    // Header
    pdf.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    // 1: Catalog
    offsets.push(pdf.len());
    pdf.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    // 2: Pages
    offsets.push(pdf.len());
    pdf.extend_from_slice(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

    // 3: Page
    offsets.push(pdf.len());
    let page_obj = format!(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.2} {:.2}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n",
        page_w, page_h
    );
    pdf.extend_from_slice(page_obj.as_bytes());

    // 4: Contents
    offsets.push(pdf.len());
    let contents_obj = format!(
        "4 0 obj\n<< /Length {} >>\nstream\n{}endstream\nendobj\n",
        content_stream.len(),
        content_stream
    );
    pdf.extend_from_slice(contents_obj.as_bytes());

    // 5: XObject Image
    offsets.push(pdf.len());
    let img_header = format!(
        "5 0 obj\n<< /Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /{} /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n",
        img_w, img_h, colorspace, jpeg_bytes.len()
    );
    pdf.extend_from_slice(img_header.as_bytes());
    pdf.extend_from_slice(jpeg_bytes);
    pdf.extend_from_slice(b"\nendstream\nendobj\n");

    // XRef table
    let xref_offset = pdf.len();
    let num_objects = offsets.len() + 1;
    let mut xref = format!("xref\n0 {}\n0000000000 65535 f \n", num_objects);
    for offset in &offsets {
        xref.push_str(&format!("{:010} 00000 n \n", offset));
    }
    pdf.extend_from_slice(xref.as_bytes());

    // Trailer
    let trailer = format!(
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
        num_objects, xref_offset
    );
    pdf.extend_from_slice(trailer.as_bytes());

    Ok(pdf)
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
    // 3) Simpan ke storage (Online via File API atau Offline via AppData lokal)
    let cfg = crate::config::load_config(&app);
    let (target_str, file_name, mime) = if cfg.mode == "online" && !cfg.storage_api_url.trim().is_empty() {
        let res = crate::storage::upload_to_remote(&cfg.storage_api_url, &cfg.storage_api_key, &id, &source_path).await?;
        // Simpan salinan ke cache lokal agar pratinjau oleh komputer pengunggah berlangsung 0 ms (instan)
        let cache_dir = std::env::temp_dir().join("simbasi_cache");
        let _ = std::fs::create_dir_all(&cache_dir);
        let stored_fname = std::path::Path::new(&res.0).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if !stored_fname.is_empty() {
            let _ = std::fs::copy(&source_path, cache_dir.join(format!("{}_{}", id, stored_fname)));
        }
        res
    } else {
        let target = crate::storage::copy_bukti(&app, &id, &source_path)
            .map_err(|e| format!("Gagal menyimpan file bukti. Coba lagi. ({e})"))?;
        let fname = std::path::Path::new(&source_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let m = mime_of(&source_path).unwrap_or("application/octet-stream").to_string();
        (target.to_string_lossy().to_string(), fname, m)
    };

    // 4) hapus file lama jika ada (BR-04)
    let old: (Option<String>,) = sqlx::query_as(
        "SELECT file_path FROM koreksi_bmd WHERE id=$1::uuid",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(|_| "Record tidak ditemukan.".to_string())?;
    if let Some(old) = old.0 {
        if cfg.mode == "online" && !cfg.storage_api_url.trim().is_empty() && (old.starts_with("bukti/") || old.starts_with("http")) {
            let _ = crate::storage::delete_remote_file(&cfg.storage_api_url, &cfg.storage_api_key, &old).await;
        } else {
            crate::storage::remove_file(&old);
        }
    }
    // 5) update record
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

    let output_format = opts.output_format.unwrap_or_else(|| "PDF".to_string());
    let output_format_clone = output_format.clone();

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
            let wants_pdf = output_format_clone.eq_ignore_ascii_case("PDF");

            if wants_pdf {
                // Konversi JPEG menjadi Dokumen PDF standar resmi
                let jpeg_bytes = std::fs::read(&scanned_path)
                    .map_err(|e| format!("Gagal membaca hasil scan JPEG: {e}"))?;
                let pdf_bytes = wrap_jpeg_as_pdf(&jpeg_bytes, &page_size_clone)?;

                let pdf_name = format!(
                    "simbasi_staging_{}.pdf",
                    chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
                );
                let pdf_path = temp_dir.join(&pdf_name);
                std::fs::write(&pdf_path, &pdf_bytes)
                    .map_err(|e| format!("Gagal menyimpan berkas PDF staging: {e}"))?;

                // Hapus berkas temporary JPEG
                let _ = std::fs::remove_file(&scanned_path);

                let pdf_path_str = pdf_path.to_string_lossy().to_string();
                let file_name = format!("Scan_{}_{}DPI_{}.pdf", source_clone, dpi, page_size_clone);
                let data_url = format!(
                    "data:application/pdf;base64,{}",
                    base64::engine::general_purpose::STANDARD.encode(&pdf_bytes)
                );

                Ok(Some(StagedFile {
                    source_path: pdf_path_str,
                    file_name,
                    file_size: pdf_bytes.len() as u64,
                    file_type: "application/pdf".to_string(),
                    data_url,
                }))
            } else {
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
pub async fn delete_bukti(app: tauri::AppHandle, db: &PgPool, id: String) -> Result<KoreksiRow, String> {
    let old: (Option<String>,) = sqlx::query_as(
        "SELECT file_path FROM koreksi_bmd WHERE id=$1::uuid",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(|_| "Record tidak ditemukan.".to_string())?;

    if let Some(old_path) = old.0 {
        let cfg = crate::config::load_config(&app);
        if cfg.mode == "online" && !cfg.storage_api_url.trim().is_empty() && (old_path.starts_with("bukti/") || old_path.starts_with("http")) {
            let _ = crate::storage::delete_remote_file(&cfg.storage_api_url, &cfg.storage_api_key, &old_path).await;
        } else {
            crate::storage::remove_file(&old_path);
        }
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

/// Baca bukti: baik Mode Online maupun Offline, kembalikan Data URL Base64 yang di-encode langsung dari Rust native.
/// Ini menjamin 100% kompatibilitas pada production build (https://tauri.localhost) tanpa terblokir Mixed Content / Iframe X-Frame-Options.
pub async fn get_bukti_base64(app: tauri::AppHandle, db: &PgPool, id: String) -> Result<(String, String), String> {
    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT file_path, file_name FROM koreksi_bmd WHERE id=$1::uuid",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(|_| "Record tidak ditemukan.".to_string())?;
    
    let fp = row.0.ok_or_else(|| "Belum ada file bukti.".to_string())?;
    let fp_norm = fp.replace('\\', "/");
    let mime = mime_of(&fp_norm).unwrap_or("application/octet-stream").to_string();
    let cfg = crate::config::load_config(&app);

    // Ambil nama file asli
    let fname = row.1.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
        std::path::Path::new(&fp_norm)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let cache_dir = std::env::temp_dir().join("simbasi_cache");
    let _ = std::fs::create_dir_all(&cache_dir);
    let cached_file = cache_dir.join(format!("{}_{}", id, fname));

    // MODE ONLINE: Cek cache disk lokal terlebih dahulu (Instan < 3ms), jika belum ada unduh sekali dari server Cloud
    if cfg.mode == "online" && !cfg.storage_api_url.trim().is_empty() {
        let base_url = cfg.storage_api_url.trim_end_matches('/');

        // 1. Cek direktori cache disk lokal
        if cached_file.exists() {
            if let Ok(bytes) = std::fs::read(&cached_file) {
                let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
                let data_url = format!("data:{mime};base64,{encoded}");
                return Ok((mime, data_url));
            }
        }

        // 2. Jika belum ada di cache, unduh dari server Cloud lalu simpan ke disk cache
        if !fname.is_empty() {
            let download_url = format!("{base_url}/api/bukti/{id}/{fname}");

            let client = reqwest::Client::builder()
                .tcp_nodelay(true)
                .pool_max_idle_per_host(10)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new());

            let mut req = client.get(&download_url);
            if !cfg.storage_api_key.trim().is_empty() {
                req = req.header("x-api-key", cfg.storage_api_key.trim());
            }

            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        // Simpan ke disk cache lokal untuk akses instan berikutnya
                        let _ = std::fs::write(&cached_file, &bytes);

                        let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
                        let data_url = format!("data:{mime};base64,{encoded}");
                        return Ok((mime, data_url));
                    }
                }
            }
        }
    }

    // Fallback: Jika cache lokal ada
    if cached_file.exists() {
        if let Ok(bytes) = std::fs::read(&cached_file) {
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            let data_url = format!("data:{mime};base64,{encoded}");
            return Ok((mime, data_url));
        }
    }

    // MODE OFFLINE / Fallback ke folder penyimpanan lokal AppData
    if let Ok(app_dir) = crate::storage::app_root(&app) {
        let local_path = app_dir.join("bukti").join(&id).join(&fname);
        if local_path.exists() {
            return crate::storage::read_bukti_as_data_url(&local_path.to_string_lossy())
                .map_err(|e| format!("File bukti tidak dapat dibaca: {e}"));
        }
    }

    crate::storage::read_bukti_as_data_url(&fp)
        .map_err(|e| format!("File bukti tidak dapat dibaca: {e}"))
}
