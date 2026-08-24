# make-release.ps1 — Script otomatis Build + Sign + Generate latest.json untuk GitHub Releases
# Penggunaan:
#   .\make-release.ps1
#   atau: .\make-release.ps1 1.2.2

param (
    [Parameter(Position=0, Mandatory=$false)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

$RootDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RootDir)) {
    $RootDir = (Get-Location).Path
}

# 1. Jika versi dispesifikasikan, patch versi terlebih dahulu
if (-not [string]::IsNullOrWhiteSpace($Version)) {
    Write-Host "Menyesuaikan nomor versi ke $Version..." -ForegroundColor Cyan
    & (Join-Path $RootDir "set-version.ps1") $Version
}

# Baca versi dari tauri.conf.json
$tauriConf = Get-Content (Join-Path $RootDir "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$CurrentVer = $tauriConf.version
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  Mempersiapkan Rilis SIMBASI BMD v$CurrentVer" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

# 2. Siapkan Private Key untuk signing
$keyPath = Join-Path $RootDir "simbasi.key"
if (-not (Test-Path $keyPath)) {
    Write-Host "[ERROR] File kunci private 'simbasi.key' tidak ditemukan di root project!" -ForegroundColor Red
    exit 1
}

$keyContent = (Get-Content $keyPath -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY = $keyContent
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $keyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
$env:CI = "true"

Write-Host "Mengompilasi aplikasi dan menandatangani binary rilis..." -ForegroundColor Cyan
npx @tauri-apps/cli build --ci
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Kompilasi tauri build gagal." -ForegroundColor Red
    exit 1
}

# 3. Kumpulkan file-file rilis ke folder release-output/
$outDir = Join-Path $RootDir "release-output"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
} else {
    # Bersihkan file rilis lama di folder output
    Remove-Item (Join-Path $outDir "*") -Recurse -Force -ErrorAction SilentlyContinue
}

$bundleDir = Join-Path $RootDir "src-tauri\target\release\bundle"
$setupExe = Get-ChildItem -Path $bundleDir -Filter "*$CurrentVer*.exe" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setupExe) {
    $setupExe = Get-ChildItem -Path $bundleDir -Filter "*.exe" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$setupZip = Get-ChildItem -Path $bundleDir -Filter "*$CurrentVer*.zip" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setupZip) {
    $setupZip = Get-ChildItem -Path $bundleDir -Filter "*.zip" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$setupSig = Get-ChildItem -Path $bundleDir -Filter "*$CurrentVer*.sig" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setupSig) {
    $setupSig = Get-ChildItem -Path $bundleDir -Filter "*.sig" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

if ($setupExe) {
    Copy-Item $setupExe.FullName -Destination $outDir -Force
    Write-Host "  [OK] Installer: $($setupExe.Name)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Installer .exe tidak ditemukan di bundle." -ForegroundColor Yellow
}

if ($setupZip) {
    Copy-Item $setupZip.FullName -Destination $outDir -Force
    Write-Host "  [OK] Update Zip: $($setupZip.Name)" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] File update .zip tidak ditemukan! Pastikan bundle.createUpdaterArtifacts aktif." -ForegroundColor Red
}

if ($setupSig) {
    Copy-Item $setupSig.FullName -Destination $outDir -Force
    Write-Host "  [OK] Signature: $($setupSig.Name)" -ForegroundColor Green
}

# 4. Generate atau salin file latest.json
$sigContent = ""
if ($setupSig -and (Test-Path $setupSig.FullName)) {
    $sigContent = (Get-Content $setupSig.FullName -Raw).Trim()
}

$zipFileName = if ($setupZip) { $setupZip.Name } else { "SIMBASI BMD_${CurrentVer}_x64-setup.nsis.zip" }

# Encode URL spasi menjadi titik atau URL encoded
$encodedZipName = [System.Uri]::EscapeDataString($zipFileName)
$downloadUrl = "https://github.com/forceware680/BASI/releases/download/v${CurrentVer}/$encodedZipName"

$latestJson = @{
    version = $CurrentVer
    notes = "Pembaruan SIMBASI BMD v${CurrentVer}:`n- Pembaruan sistem dan peningkatan stabilitas data."
    pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = $sigContent
            url = $downloadUrl
        }
    }
}

$jsonPath = Join-Path $outDir "latest.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$jsonString = $latestJson | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($jsonPath, $jsonString, $utf8NoBom)

Write-Host "  [OK] Manifest: latest.json" -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  SELESAI! Seluruh file rilis siap di folder: release-output/" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Langkah Publikasi ke GitHub Releases:" -ForegroundColor Yellow
Write-Host "1. Buka: https://github.com/forceware680/BASI/releases/new (atau edit release v$CurrentVer)" -ForegroundColor White
Write-Host "2. Pastikan Tag: v${CurrentVer}" -ForegroundColor White
Write-Host "3. Tarik (Drag & drop) SEMUA file di folder 'release-output/' ke release assets:" -ForegroundColor White
Write-Host "   - $zipFileName (Penting untuk auto update!)" -ForegroundColor Cyan
Write-Host "   - $($setupSig.Name)" -ForegroundColor Cyan
Write-Host "   - $($setupExe.Name)" -ForegroundColor Cyan
Write-Host "   - latest.json" -ForegroundColor Cyan
Write-Host "4. Klik 'Publish release'. Selesai!" -ForegroundColor White
Write-Host "============================================================`n" -ForegroundColor Green
