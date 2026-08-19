# scripts/setup-portable-pgsql.ps1
# Menyiapkan biner PostgreSQL portabel untuk build installer tanpa mengotori riwayat Git.

$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "..\src-tauri\resources\pgsql"
$destBin = Join-Path $dest "bin"
$destShare = Join-Path $dest "share"

if (Test-Path (Join-Path $destBin "postgres.exe")) {
    Write-Host "[OK] Biner PostgreSQL portabel sudah terpasang di: $dest" -ForegroundColor Green
    exit 0
}

Write-Host "[INFO] Menyiapkan paket biner PostgreSQL portabel..." -ForegroundColor Cyan

# 1. Cari instalasi PostgreSQL lokal yang sudah ada di komputer pengembang
$searchPaths = @(
    "C:\Program Files\PostgreSQL\18",
    "C:\Program Files\PostgreSQL\17",
    "C:\Program Files\PostgreSQL\16",
    "C:\Program Files\PostgreSQL\15"
)

$foundPg = $null
foreach ($p in $searchPaths) {
    if (Test-Path (Join-Path $p "bin\postgres.exe")) {
        $foundPg = $p
        break
    }
}

if ($foundPg) {
    Write-Host "[INFO] Menyalin biner PostgreSQL dari instalasi lokal: $foundPg" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $destBin -Force | Out-Null
    New-Item -ItemType Directory -Path $destShare -Force | Out-Null

    $exes = @("postgres.exe", "initdb.exe", "pg_ctl.exe", "psql.exe")
    foreach ($exe in $exes) {
        $srcExe = Join-Path $foundPg "bin\$exe"
        if (Test-Path $srcExe) {
            Copy-Item $srcExe (Join-Path $destBin $exe) -Force
        }
    }

    # Salin semua DLL dependensi
    Get-ChildItem (Join-Path $foundPg "bin\*.dll") | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $destBin $_.Name) -Force
    }

    # Salin share folder (timezone, tablespace, sql template)
    Copy-Item (Join-Path $foundPg "share\*") $destShare -Recurse -Force

    Write-Host "[SUCCESS] Biner PostgreSQL portabel berhasil disiapkan untuk build installer." -ForegroundColor Green
    exit 0
}

Write-Host "[WARN] Tidak ditemukan instalasi PostgreSQL di direktori standar C:\Program Files\PostgreSQL\." -ForegroundColor Yellow
Write-Host "[INFO] Anda dapat menyalin folder 'bin' dan 'share' PostgreSQL manual ke: src-tauri\resources\pgsql\" -ForegroundColor Yellow
