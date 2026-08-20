# SIMBASI BMD

Sistem Informasi Manajemen Pelacakan & Sirkulasi Berita Acara (BA) Koreksi Barang Milik Daerah (BMD) Badan Pengelola Keuangan dan Aset Daerah (BPKAD) Pemerintah Kota Magelang.

Aplikasi desktop native berbasis **Tauri v2 (Rust)**, **React 19**, **TypeScript**, dan **Tailwind CSS** dengan dukungan arsitektur **Dual-Engine Database (Offline Standalone & Online Cloud Multi-User)** serta **File API Storage Service**.

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

### 3. Konfigurasi Biner PostgreSQL Portabel (Mode Offline)
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

## 🌐 Arsitektur Dual-Engine: Offline vs Online Cloud

Aplikasi SIMBASI BMD dirancang fleksibel untuk dapat berjalan secara independen di satu PC atau terhubung ke server cloud multi-user:

### 1. Mode Offline (Lokal Komputer)
* **Database**: PostgreSQL lokal portabel (port `5432`).
* **Penyimpanan Berkas Scan**: Disimpan di direktori lokal pengguna (`%APPDATA%/com.bpkad.simbasi.bmd/bukti/`).
* **Kebutuhan Jaringan**: 100% tanpa internet (zero-dependency).

### 2. Mode Online (Cloud Server Terpusat)
* **Database Cloud**: Terhubung ke PostgreSQL Server terpusat:
  ```text
  postgres://<DB_USER>:<DB_PASSWORD>@<SERVER_HOST>:<PORT>/<DB_NAME>
  ```
* **File Storage Microservice**: Berkas scan PDF/JPG diunggah dan dialirkan melalui File API Service mandiri:
  ```text
  http://<DOMAIN_ATAU_IP_SERVER>
  ```
* **Hot-Switch Runtime**: Pengguna dapat berpindah antara Mode Offline dan Online langsung melalui menu **"Pengaturan Koneksi & Database"** tanpa perlu restart aplikasi.

---

## 🗄️ Manajemen Database Cerdas (Zero-Config & Auto-Migration)

1. **Inisialisasi Otomatis**:
   Database `sim_ba_koreksi`, tabel, relasi constraint unik, dan seeder master data 45 OPD diinisialisasi otomatis via SQLx migrations saat startup.
2. **Safe Daemon**:
   Pada Mode Offline, engine PostgreSQL lokal otomatis menyala saat aplikasi dibuka dan mati secara bersih (*safe shutdown*) saat aplikasi ditutup.

---

## ✨ Fitur Utama

* **Master Data 45 OPD**: Pilihan cepat instansi/unit kerja pengusul serta penambahan instansi baru secara langsung.
* **Auto-Format Nomor Dinas**: Otomatisasi format nomor surat dinas standar Kota Magelang (`000.2.3.2/[nomor]/440`).
* **Pelacakan Status Sirkulasi**: Status real-time (*MENUNGGU BUKTI* dan *SELESAI*).
* **Pencetakan Dokumen Resmi**:
  * Lembar Tanda Terima Ekspedisi Tunggal (Kop resmi Pemerintah Kota Magelang).
  * Rekapitulasi Laporan Berita Acara berdasarkan rentang tanggal dan status.
* **Unggah Bukti Scan (File Explorer & Mesin Scanner Langsung)**:
  * Pemindaian fisik langsung dari scanner via antarmuka Windows Image Acquisition (WIA) dengan dukungan ADF (Feeder) auto-centering A4/F4, Flatbed, 150–1200 DPI, dan pemilihan mode warna.
  * Pratinjau interaktif dan penyimpanan aman format PDF Dokumen Resmi (`.pdf`) atau Gambar (`.jpg`).
* **Pratinjau Instan & Integrasi OS**:
  * Viewer internal responsif dengan sistem *disk cache* biner (< 3ms).
  * Tombol **"Buka di OS"** untuk membuka berkas secara langsung di aplikasi default Windows (Adobe Acrobat, Foxit, Windows Photos).
* **Cadangan & Pemulihan (Backup & Restore)**:
  * **Mode Offline**: Mengemas data lokal dan file bukti menjadi 1 arsip `.zip`.
  * **Mode Online**: Mengunduh seluruh data database Cloud & berkas scan dari server File API menjadi 1 arsip `.zip` lokal, atau memulihkannya kembali ke server secara utuh.
* **Dark Mode Tonal Elevation**: Antarmuka adaptif tema terang / gelap dengan standar kontras WCAG AAA.
* **Console Monitor**: Toggle jendela CMD di header untuk memantau log aktivitas database dan proses aplikasi secara langsung.
* **Pintasan Keyboard Cepat (Hotkeys)**:
  * <kbd>+</kbd> (Numpad Plus): Membuka form Tambah Koreksi Baru secara instan.
  * <kbd>F5</kbd>: Menyegarkan data tabel dari database.
  * <kbd>Ctrl</kbd> + <kbd>S</kbd>: Menyimpan formulir koreksi.
  * <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>: Menyimpan formulir dan langsung mencetak tanda terima.
  * <kbd>Esc</kbd>: Menutup modal / dialog aktif.

---

## 📂 Struktur Direktori Proyek

```text
BASI/
├── file-service/                 # Microservice Node.js / Express untuk File Storage Cloud
│   ├── src/server.js             # API Upload, Stream, Viewer, & Delete Berkas Bukti
│   ├── Dockerfile                # Docker container definition
│   └── docker-compose.yml        # Compose config dengan volume mount /data/simbasi/bukti
├── scripts/                      # Skrip otomatisasi pengembang
│   └── setup-portable-pgsql.ps1  # Penyiapan biner PostgreSQL portabel
├── src/                          # Kode Sumber Frontend (React + TypeScript)
│   ├── components/               # Komponen UI, dialog modal, koneksi, & viewer
│   │   └── print/                # Template cetak ekspedisi dan laporan rekapitulasi
│   ├── lib/                      # Type definitions, tema, dan IPC bridge Tauri
│   └── pages/                    # Halaman utama aplikasi
├── src-tauri/                    # Kode Sumber Backend Desktop (Rust)
│   ├── migrations/               # SQLx schema migrations & master data OPD
│   ├── resources/                # Biner PostgreSQL portabel (diabaikan Git)
│   ├── src/
│   │   ├── commands/             # Handler IPC Tauri (Koreksi, OPD, Bukti, Backup)
│   │   ├── config.rs             # Konfigurasi persistensi Mode Offline / Online
│   │   ├── db.rs                 # Connection pool SQLx & hot-reconnect database
│   │   ├── storage.rs            # Manajemen penyimpanan lokal & remote File API
│   │   ├── main.rs               # Entry point Tauri & lifecycle window
│   │   └── pgsql_daemon.rs       # Daemon manager PostgreSQL portabel
│   └── tauri.conf.json           # Konfigurasi paket Tauri & bundle installer
└── package.json                  # Konfigurasi dependensi Node.js & skrip build
```
