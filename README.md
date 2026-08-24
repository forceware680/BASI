# SIMBASI BMD

Sistem Informasi Manajemen Pelacakan & Sirkulasi Berita Acara (BA) Koreksi Barang Milik Daerah (BMD) Badan Pengelola Keuangan dan Aset Daerah (BPKAD) Pemerintah Kota Magelang.

Aplikasi desktop native berbasis **Tauri v2 (Rust)**, **React 19**, **TypeScript**, dan **Tailwind CSS** dengan dukungan arsitektur **Dual-Engine Database (Offline Standalone & Online Cloud Multi-User)**, **Role-Based Access Control (RBAC)**, **File API Storage Service**, serta **In-App Auto Updater**.

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

## 🔄 Pembaruan Versi & Rilis Otomatis (Auto Updater)

Aplikasi SIMBASI BMD dilengkapi fitur **In-App Auto Updater** berbasis Tauri v2 dan GitHub Releases.

### 1. Mengubah Nomor Versi Proyek
Untuk memperbarui versi di seluruh 4 file (`package.json`, `tauri.conf.json`, `Cargo.toml`, dan `LoginScreen.tsx`):
```bash
npm run set-version 1.0.1
```

### 2. Membuat Paket Rilis Siap Publikasi (1 Perintah)
Jalankan skrip otomasi rilis berikut:
```bash
npm run make-release 1.0.1
```
*(atau jalankan `.\make-release.bat 1.0.1`)*

Skrip ini akan secara otomatis:
1. Menyesuaikan nomor versi di seluruh file konfigurasi.
2. Mengompilasi aplikasi dan menandatanganinya dengan kunci digital kriptografi (*Tauri Signer*).
3. Mengumpulkan **3 berkas rilis** ke dalam folder **`release-output/`**:
   * 🚀 **`SIMBASI BMD_1.0.1_x64-setup.exe`** (Installer utama & biner pembaruan)
   * 🔏 **`SIMBASI BMD_1.0.1_x64-setup.exe.sig`** (Tanda tangan keamanan)
   * 📄 **`latest.json`** (Manifest metadata update untuk aplikasi)

### 3. Publikasi ke GitHub Releases
1. Buka: `https://github.com/forceware680/BASI/releases/new`
2. Masukkan Tag: `v1.0.1` dan Title: `SIMBASI BMD v1.0.1`.
3. Unggah seluruh 3 file di dalam folder `release-output/`.
4. Klik **Publish release**. Seluruh pengguna aplikasi desktop akan menerima notifikasi update otomatis dan dapat memperbarui aplikasi langsung hanya dengan 1 klik!

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

## 👥 Autentikasi & Hak Akses (RBAC)

Aplikasi memiliki sistem login aman berbasis token sesi dan password hashing bcrypt:

1. **Administrator**:
   * Memiliki akses penuh ke seluruh menu dan data.
   * Mengatur kredensial sensitif database PostgreSQL Cloud dan File API Storage.
   * Mengelola akun pengguna (Tambah, Edit, Nonaktifkan, Reset Password, Hapus Operator/Admin).
   * Melakukan Backup & Restore database lengkap (termasuk tabel pengguna).
2. **Operator**:
   * Melakukan pencatatan ekspedisi BA koreksi, upload bukti scan, dan cetak tanda terima.
   * Dapat beralih antara mode Offline dan Online.
   * Pengaturan kredensial sensitif database disembunyikan untuk menjaga keamanan server.
   * Dapat mengubah kata sandi akun masing-masing.

---

## ✨ Fitur Utama

* **In-App Auto Updater**: Pemeriksaan versi baru di latar belakang dengan indikator badge dan dialog unduh otomatis berkecepatan tinggi.
* **Kolom Pencatat & Role Badge**: Informasi transparan mengenai nama dan peran petugas penginput pada setiap baris data ekspedisi.
* **Master Data 45 OPD**: Pilihan instansi/unit kerja pengusul dengan fitur penambahan instansi baru secara langsung.
* **Auto-Format Nomor Dinas**: Otomatisasi format nomor surat dinas standar Kota Magelang (`000.2.3.2/[nomor]/440`).
* **Pelacakan Status Sirkulasi**: Status real-time (*MENUNGGU BUKTI* dan *SELESAI*).
* **Pencetakan Dokumen Resmi**:
  * Lembar Tanda Terima Ekspedisi Tunggal (Kop resmi Pemerintah Kota Magelang).
  * Rekapitulasi Laporan Berita Acara berdasarkan rentang tanggal, instansi OPD, dan status.
* **Unggah Bukti Scan (File Explorer & Mesin Scanner Fisik Langsung)**:
  * Pemindaian fisik langsung via Windows Image Acquisition (WIA) dengan dukungan ADF (Feeder) auto-centering A4/F4, Flatbed, 150–1200 DPI, dan pemilihan mode warna.
  * Pratinjau interaktif dan penyimpanan aman format Dokumen Resmi (`.pdf`) atau Gambar (`.jpg`).
* **Pratinjau Instan & Integrasi OS**:
  * Viewer internal responsif dengan sistem *disk cache* biner (< 3ms).
  * Tombol **"Buka di OS"** untuk membuka berkas secara langsung di aplikasi default Windows (Adobe Acrobat, Foxit, Windows Photos).
* **Cadangan & Pemulihan (Backup & Restore)**:
  * Mengemas seluruh data (`koreksi_bmd`, `master_opd`, `users`) dan file fisik scan menjadi 1 arsip `.zip` yang dapat dipulihkan kapan pun.
* **Performa Seketika (Non-Blocking Startup)**:
  * Inisialisasi pool database asinkron yang membuat aplikasi terbuka responsif dalam < 200 ms tanpa pernah hang.
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
├── release-output/               # Direktori output build rilis & manifest latest.json
├── scripts/                      # Skrip otomatisasi penyiapan lingkungan
│   └── setup-portable-pgsql.ps1  # Penyiapan biner PostgreSQL portabel
├── src/                          # Kode Sumber Frontend (React 19 + TypeScript + Tailwind)
│   ├── components/               # Komponen UI, dialog modal, auto updater, koneksi, & viewer
│   │   └── print/                # Template cetak ekspedisi dan laporan rekapitulasi
│   ├── lib/                      # Auth RBAC, types, tema, dan IPC bridge Tauri
│   └── pages/                    # Halaman utama aplikasi
├── src-tauri/                    # Kode Sumber Backend Desktop (Rust Tauri v2)
│   ├── capabilities/             # Definisi hak akses & permissions IPC
│   ├── migrations/               # SQLx schema migrations, master data OPD, & users
│   ├── resources/                # Biner PostgreSQL portabel (diabaikan Git)
│   ├── src/
│   │   ├── commands/             # Handler IPC Tauri (Koreksi, OPD, Bukti, Backup, Users)
│   │   ├── config.rs             # Konfigurasi persistensi Mode Offline / Online
│   │   ├── db.rs                 # Connection pool SQLx non-blocking & hot-reconnect
│   │   ├── storage.rs            # Manajemen penyimpanan lokal & remote File API
│   │   ├── main.rs               # Entry point Tauri, plugin updater, & window lifecycle
│   │   └── pgsql_daemon.rs       # Daemon manager PostgreSQL portabel
│   └── tauri.conf.json           # Konfigurasi bundle Tauri, signing pubkey, & updater
├── make-release.ps1              # Skrip build, digital sign, & generate manifest rilis
├── set-version.ps1               # Skrip multi-file version patcher
└── package.json                  # Konfigurasi dependensi Node.js & skrip build
```
