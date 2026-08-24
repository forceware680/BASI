# set-version.ps1 — Script otomatis patch versi di 4 file aplikasi SIMBASI BMD (UTF-8 No-BOM)
# Penggunaan:
#   .\set-version.ps1 1.2.0
#   atau jalankan tanpa argumen: .\set-version.ps1

param (
    [Parameter(Position=0, Mandatory=$false)]
    [string]$NewVersion
)

$ErrorActionPreference = "Stop"

# 1. Jika argumen tidak diisi, minta input dari pengguna
if ([string]::IsNullOrWhiteSpace($NewVersion)) {
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  SIMBASI BMD - Pembaruan Versi Build Aplikasi" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    $NewVersion = Read-Host "Masukkan nomor versi baru (contoh: 1.2.0 atau v1.2.0)"
}

# 2. Bersihkan prefix 'v' atau 'V' jika ada
$CleanVersion = $NewVersion.Trim().TrimStart('v').TrimStart('V').Trim()

if ($CleanVersion -notmatch '^\d+\.\d+\.\d+') {
    Write-Host "ERROR: Format versi tidak valid! Gunakan format semver seperti '1.2.0'." -ForegroundColor Red
    exit 1
}

$RootDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RootDir)) {
    $RootDir = (Get-Location).Path
}

# UTF-8 Encoding TANPA BOM (Penting agar Node.js / Vite / JSON parser tidak error Unexpected token BOM)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host ""
Write-Host "Memperbarui versi menjadi v$CleanVersion..." -ForegroundColor Cyan

# 1. Update package.json
$pkgPath = Join-Path $RootDir "package.json"
if (Test-Path $pkgPath) {
    $content = [System.IO.File]::ReadAllText($pkgPath, [System.Text.Encoding]::UTF8)
    # Bersihkan BOM jika ada sebelumnya
    $content = $content.TrimStart([char]0xFEFF)
    $updated = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        '("version"\s*:\s*)"[^"]+"',
        "`$1`"$CleanVersion`""
    )
    [System.IO.File]::WriteAllText($pkgPath, $updated, $utf8NoBom)
    Write-Host "  [OK] package.json               -> version: `"$CleanVersion`"" -ForegroundColor Green
} else {
    Write-Host "  [WARN] package.json tidak ditemukan." -ForegroundColor Yellow
}

# 2. Update src-tauri/tauri.conf.json
$tauriConfPath = Join-Path $RootDir "src-tauri\tauri.conf.json"
if (Test-Path $tauriConfPath) {
    $content = [System.IO.File]::ReadAllText($tauriConfPath, [System.Text.Encoding]::UTF8)
    $content = $content.TrimStart([char]0xFEFF)
    $updated = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        '("version"\s*:\s*)"[^"]+"',
        "`$1`"$CleanVersion`""
    )
    [System.IO.File]::WriteAllText($tauriConfPath, $updated, $utf8NoBom)
    Write-Host "  [OK] src-tauri/tauri.conf.json  -> version: `"$CleanVersion`"" -ForegroundColor Green
} else {
    Write-Host "  [WARN] src-tauri/tauri.conf.json tidak ditemukan." -ForegroundColor Yellow
}

# 3. Update src-tauri/Cargo.toml
$cargoPath = Join-Path $RootDir "src-tauri\Cargo.toml"
if (Test-Path $cargoPath) {
    $content = [System.IO.File]::ReadAllText($cargoPath, [System.Text.Encoding]::UTF8)
    $content = $content.TrimStart([char]0xFEFF)
    $updated = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        '(?m)^version\s*=\s*"[^"]+"',
        "version = `"$CleanVersion`""
    )
    [System.IO.File]::WriteAllText($cargoPath, $updated, $utf8NoBom)
    Write-Host "  [OK] src-tauri/Cargo.toml       -> version = `"$CleanVersion`"" -ForegroundColor Green
} else {
    Write-Host "  [WARN] src-tauri/Cargo.toml tidak ditemukan." -ForegroundColor Yellow
}

# 4. Update src/components/LoginScreen.tsx
$loginPath = Join-Path $RootDir "src\components\LoginScreen.tsx"
if (Test-Path $loginPath) {
    $content = [System.IO.File]::ReadAllText($loginPath, [System.Text.Encoding]::UTF8)
    $content = $content.TrimStart([char]0xFEFF)
    $updated = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        'v\d+\.\d+\.\d+[^<]*',
        "v$CleanVersion"
    )
    [System.IO.File]::WriteAllText($loginPath, $updated, $utf8NoBom)
    Write-Host "  [OK] src/components/LoginScreen.tsx -> v$CleanVersion" -ForegroundColor Green
} else {
    Write-Host "  [WARN] src/components/LoginScreen.tsx tidak ditemukan." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  SUKSES! Seluruh 4 file berhasil di-patch ke versi v$CleanVersion (UTF-8 No-BOM)" -ForegroundColor Green
Write-Host "  Jalankan 'npm run tauri build' untuk mengompilasi installer baru." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
