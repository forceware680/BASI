# Rencana Implementasi: Mode Database Online & File API Service SIMBASI BMD

Dokumen ini menjelaskan langkah teknis untuk mengimplementasikan integrasi Mode Online (PostgreSQL Cloud di Coolify) bersama Microservice File API dengan persistent volume mount host `/data/simbasi/bukti`, serta antarmuka pengaturan koneksi dinamis di aplikasi desktop SIMBASI BMD.

---

## 1. Arsitektur & Alur Kerja

```mermaid
flowchart TD
    subgraph Client ["Aplikasi Desktop SIMBASI BMD (Tauri)"]
        UI["Frontend React (Settings & UI)"]
        Switcher["Connection & Storage Switcher (Rust)"]
        UI --> Switcher
    end

    subgraph OfflineMode ["Mode Offline (Lokal)"]
        LocalPG["PostgreSQL Portabel / Standalone (Port 5432)"]
        LocalDisk["AppData/Roaming/.../bukti"]
    end

    subgraph OnlineMode ["Mode Online (Coolify Cloud)"]
        RemotePG["PostgreSQL Server (Port 27492)\nsim_ba_koreksi"]
        FileAPI["File API Service (Docker Container)\nPort 3000 / Subdomain"]
        HostStorage["Host VPS Volume Mount\n/data/simbasi/bukti"]
        FileAPI -->|Mount /app/uploads| HostStorage
    end

    Switcher -->|Mode == 'offline'| LocalPG
    Switcher -->|Mode == 'offline'| LocalDisk
    Switcher -->|Mode == 'online'| RemotePG
    Switcher -->|Mode == 'online'| FileAPI
```

---

## 2. User Review Required

> [!IMPORTANT]
> **Kredensial & URL Server yang Digunakan:**
> - **PostgreSQL Cloud URL**: `postgres://postgres:XSRMfNGXXAd7aRvTyanmMGbcRLIVDmxB4nf5CwFEU4g5j7VYKTvVxEWMcvRsT8bH@45.198.155.126:27492/sim_ba_koreksi`
> - **File API Service Target**: Akan dideploy sebagai container di Coolify dengan port default `3000` (atau via domain reverse proxy Coolify, misal `https://api-bukti.domain.com`).
> - **Persistent Volume Mount**: Host `/data/simbasi/bukti` -> Container `/app/uploads`.

---

## 3. Rencana Perubahan Komponen

### Bagian 1: Microservice File API (Node.js/Express + Docker)
Folder mandiri `file-service/` yang siap di-push ke git / di-deploy langsung di Coolify.

#### [NEW] [file-service/package.json](file:///c:/BASI/file-service/package.json)
- Dependency minimal: `express`, `multer`, `cors`, `dotenv`, `helmet`, `morgan`.

#### [NEW] [file-service/src/server.js](file:///c:/BASI/file-service/src/server.js)
- Endpoint:
  - `GET /health` : Health check status service.
  - `POST /api/bukti/upload` : Multipart upload file bukti per `koreksi_id` dengan validasi MIME (PDF, JPG, PNG).
  - `GET /api/bukti/:koreksi_id/:filename` : Streaming berkas untuk preview/viewer.
  - `GET /api/bukti/download/:koreksi_id/:filename` : Unduh berkas fisik.
  - `DELETE /api/bukti/:koreksi_id/:filename` : Hapus berkas fisik dari storage.
  - Middleware `x-api-key` auth.

#### [NEW] [file-service/Dockerfile](file:///c:/BASI/file-service/Dockerfile) & [file-service/docker-compose.yml](file:///c:/BASI/file-service/docker-compose.yml)
- Node 20 alpine, multi-stage / lightweight runner.
- Konfigurasi default volume mount `/data/simbasi/bukti:/app/uploads`.

#### [NEW] [file-service/README.md](file:///c:/BASI/file-service/README.md)
- Panduan step-by-step deploy di dashboard Coolify & setting persistent storage.

---

### Bagian 2: Backend Tauri (Rust)

#### [MODIFY] [Cargo.toml](file:///c:/BASI/src-tauri/Cargo.toml)
- Tambahkan dependency `reqwest = { version = "0.12", features = ["multipart", "json", "stream"] }`.

#### [NEW] [src-tauri/src/config.rs](file:///c:/BASI/src-tauri/src/config.rs)
- Struct `AppConfig`:
  - `mode`: `"offline"` | `"online"`
  - `database_url`: String
  - `storage_api_url`: String (misal `http://45.198.155.126:3000`)
  - `storage_api_key`: Option<String>
- Fungsi load & save ke `app_data_dir/config.json`.

#### [MODIFY] [src-tauri/src/db.rs](file:///c:/BASI/src-tauri/src/db.rs)
- Dynamic connection pool builder: kemampuan menghubungkan ke DB Offline lokal atau DB Online Coolify sesuai `AppConfig`.
- Helper `test_connection(db_url: &str) -> Result<(), String>`.

#### [MODIFY] [src-tauri/src/storage.rs](file:///c:/BASI/src-tauri/src/storage.rs) & [src-tauri/src/commands/bukti.rs](file:///c:/BASI/src-tauri/src/commands/bukti.rs)
- Jika `mode == "offline"`: Simpan / baca / hapus file dari lokal AppData.
- Jika `mode == "online"`: Kirim file via HTTP multipart ke File API Service Coolify, baca base64 / URL streaming, dan hapus via HTTP DELETE.

#### [MODIFY] [src-tauri/src/commands/backup.rs](file:///c:/BASI/src-tauri/src/commands/backup.rs)
- Buat backup & restore mendukung hybrid/online: saat backup online, file diunduh dari File API Service dan dikemas dalam ZIP; saat restore online, file di-upload kembali ke File API Service.

#### [MODIFY] [src-tauri/src/main.rs](file:///c:/BASI/src-tauri/src/main.rs)
- Daftarkan command baru: `get_app_config`, `save_app_config`, `test_db_connection`, `test_storage_api_connection`.

---

### Bagian 3: Frontend Settings & Switcher UI

#### [NEW] [src/components/SettingsDialog.tsx](file:///c:/BASI/src/components/SettingsDialog.tsx)
- Modal modern & intuitif:
  - Toggle Switch: `Mode Offline (Lokal)` vs `Mode Online (Cloud Server)`.
  - Form Input URL Database PostgreSQL (dengan auto-fill template online/offline).
  - Form Input URL File API Service & API Key.
  - Tombol **"Tes Koneksi DB"** & **"Tes Koneksi Storage"** dengan indikator badge (Sukses/Gagal & Ping).
  - Tombol **"Simpan & Terapkan"** (dengan konfirmasi restart koneksi).

#### [MODIFY] [src/App.tsx](file:///c:/BASI/src/App.tsx)
- Tambahkan tombol **Pengaturan Koneksi** di Header dengan badge status dinamis (misal: 🟢 `Online (Cloud)` atau 🔵 `Offline (Lokal)`).

---

## 4. Rencana Verifikasi

### Pengujian File API Service
- Menjalankan unit/integration test local Docker:
  1. Health check: `GET http://localhost:3000/health`.
  2. Upload dummy file bukti: `POST /api/bukti/upload`.
  3. Verifikasi file tersimpan di volume target `/app/uploads/...`.
  4. Stream file: `GET /api/bukti/...`.

### Pengujian Frontend & Tauri Switcher
- Beralih ke Mode Online dengan URL Coolify:
  `postgres://postgres:XSRMfNGXXAd7aRvTyanmMGbcRLIVDmxB4nf5CwFEU4g5j7VYKTvVxEWMcvRsT8bH@45.198.155.126:27492/sim_ba_koreksi`
- Tes fungsi CRUD Koreksi BMD & upload file bukti.
- Beralih kembali ke Mode Offline untuk memastikan backward compatibility.
