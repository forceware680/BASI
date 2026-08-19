# SIMBASI BMD

Sistem Informasi Manajemen Pelacakan & Sirkulasi Berita Acara (BA) Koreksi Barang Milik Daerah (BMD) Badan Pengelola Keuangan dan Aset Daerah (BPKAD) Kota Magelang.

Aplikasi desktop native berbasis **Tauri v2 (Rust)**, **React 19**, **TypeScript**, dan **Tailwind CSS** dengan dukungan database **PostgreSQL**.

---

## 🚀 Panduan Setup Cepat (Pengembang Baru)

Jika Anda baru saja melakukan `git clone` proyek ini di komputer baru, ikuti langkah berikut:

### 1. Prasyarat Sistem
* [Node.js](https://nodejs.org/) (versi 18 ke atas)
* [Rust & Cargo](https://rustup.rs/) (versi 1.77 ke atas)
* [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### 2. Instalasi Dependensi
Jalankan di terminal direktori proyek:
```bash
npm install
```

### 3. Konfigurasi Biner PostgreSQL Portabel
Jalankan skrip pembantu untuk menyiapkan dependensi PostgreSQL ke dalam folder bundling:
```bash
npm run setup:pgsql
```
> **Catatan:** Skrip ini akan menyalin biner PostgreSQL lokal (`bin` dan `share`) ke direktori `src-tauri/resources/pgsql/` tanpa mengotori riwayat Git.

### 4. Menjalankan Aplikasi Mode Development
```bash
npm run tauri dev
```

---

## 📦 Membangun Installer Rilis (.exe / .msi)

Untuk mengompilasi installer produksi mandiri yang siap dibagikan ke pengguna:

```bash
npm run tauri build
```

Hasil berkas installer rilis akan berada di:
* **NSIS Setup (.exe)**: `src-tauri/target/release/bundle/nsis/SIMBASI BMD_1.0.0_x64-setup.exe`
* **WiX MSI (.msi)**: `src-tauri/target/release/bundle/msi/SIMBASI BMD_1.0.0_x64_en-US.msi`

---

## 🗄️ Mekanisme Database Cerdas (Zero-Config)

Aplikasi memiliki manajemen database otomatis:

1. **Service Standalone Terpasang**:
   Jika komputer sudah memiliki service PostgreSQL yang berjalan di port `5432`, aplikasi langsung menggunakan service tersebut tanpa menimpa atau mengubah konfigurasi database lain.
2. **Komputer Baru / Tanpa PostgreSQL**:
   Jika port `5432` belum aktif, aplikasi otomatis menyalakan engine PostgreSQL portabel bawaan ke direktori `%APPDATA%/com.bpkad.simbasi.bmd/pgsql_data`.
3. **Migrasi Otomatis**:
   Database `sim_ba_koreksi`, tabel, relasi foreign key, dan 45 data master OPD diinisialisasi otomatis saat pertama kali dibuka.
4. **Safe Shutdown**:
   Engine portabel dimatikan secara bersih saat aplikasi ditutup.

---

## ✨ Fitur Utama

* **Master Data 45 OPD**: Pilihan cepat instansi/unit kerja pengusul serta penambahan instansi baru secara langsung.
* **Auto-Format Nomor Dinas**: Otomatisasi format nomor surat dinas standar Kota Magelang (`000.2.3.2/[nomor]/440`).
* **Pelacakan Status Sirkulasi**: Status real-time (*MENUNGGU BUKTI* dan *SELESAI*).
* **Pencetakan Dokumen Resmi**:
  * Lembar Tanda Terima Ekspedisi Tunggal (Kop resmi Pemerintah Kota Magelang).
  * Rekapitulasi Laporan Berita Acara berdasarkan rentang tanggal dan status.
* **Unggah Bukti Scan (File Explorer & Mesin Scanner Langsung)**: Pilihan unggah fleksibel: pilih file dokumen digital yang sudah ada (PDF, JPG, PNG) atau memindai lembar fisik tanda terima langsung dari mesin scanner terhubung menggunakan antarmuka Windows Image Acquisition (WIA). Dilengkapi pratinjau bukti digital dan kontrol zoom interaktif.
* **Ekspor Data**: Ekspor tabel rekapitulasi ke format CSV/Excel dengan UTF-8 BOM.
* **Cadangan & Pemulihan (Backup & Restore)**: Backup penuh seluruh database PostgreSQL dan berkas fisik bukti scan menjadi 1 file `.zip`.
* **Dark Mode**: Antarmuka adaptif tema terang / gelap dengan palet warna nyaman mata.
* **Console Monitor**: Toggle jendela CMD di header untuk memantau log aktivitas database dan proses aplikasi secara langsung.
* **Pintasan Keyboard Cepat (Hotkeys)**:
  * <kbd>+</kbd> (Numpad Plus): Membuka form Tambah Koreksi Baru secara instan.
  * <kbd>F5</kbd>: Menyegarkan data tabel dari database.
  * <kbd>Ctrl</kbd> + <kbd>S</kbd>: Menyimpan formulir koreksi.
  * <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>: Menyimpan formulir koreksi dan langsung membuka dialog cetak tanda terima.
  * <kbd>Esc</kbd>: Menutup modal / dialog aktif.

---

## 📂 Struktur Direktori

```text
BASI/
├── scripts/                      # Skrip pembantu otomatisasi pengembang
│   └── setup-portable-pgsql.ps1  # Penyiapan biner PostgreSQL portabel
├── src/                          # Kode Sumber Frontend (React + TypeScript)
│   ├── components/               # Komponen UI, dialog modal, dan tabel
│   │   └── print/                # Template cetak ekspedisi dan laporan rekapitulasi
│   ├── lib/                      # Type definitions, tema, dan IPC bridge Tauri
│   └── pages/                    # Halaman utama aplikasi
├── src-tauri/                    # Kode Sumber Backend Desktop (Rust)
│   ├── migrations/               # SQLx schema migrations & master data OPD
│   ├── resources/                # Biner PostgreSQL portabel (diabaikan Git)
│   ├── src/
│   │   ├── commands/             # Handler IPC Tauri (Koreksi, OPD, Bukti, Backup)
│   │   ├── db.rs                 # Koneksi pool SQLx & migrasi database
│   │   ├── main.rs               # Entry point Tauri & lifecycle window
│   │   └── pgsql_daemon.rs       # Daemon manager PostgreSQL portabel
│   └── tauri.conf.json           # Konfigurasi paket Tauri & bundle installer
└── package.json                  # Konfigurasi dependensi Node.js & skrip build
```
