# SIMBASI File API Microservice

Microservice ringan berbasis **Node.js (Express) & Docker** untuk mengelola penyimpanan berkas bukti fisik (PDF & Scan Gambar) aplikasi **SIMBASI BMD Pemerintah Kota Magelang**.

---

## 🚀 Panduan Deploy di Coolify

### Opsi A: Deploy via Git Repository di Coolify (Direkomendasikan)
1. Push folder `file-service` ini ke repository Git (GitHub / GitLab / Gitea).
2. Di Dashboard Coolify:
   - Klik **Projects** -> Pilih Environment (misal `production` / `SMLMB`).
   - Klik **+ New Resource** -> **Application** -> **Public/Private Repository**.
   - Masukkan link repository Git Anda.
   - Pilih **Base Directory**: `/file-service` (jika berada dalam subfolder monorepo) atau `/` jika repo terpisah.
   - Pilih **Build Pack**: `Dockerfile`.
3. Atur **Environment Variables** di Coolify:
   ```env
   PORT=3000
   NODE_ENV=production
   UPLOAD_DIR=/app/uploads
   API_KEY=simbasi_secret_key_bpkad_magelang
   ```
4. Atur **Persistent Storage** di Coolify:
   - Masuk ke tab **Persistent Storage** -> Klik **+ Add mount**.
   - **Source Path (Host VPS)**: `/data/simbasi/bukti`
   - **Destination Path (Container)**: `/app/uploads`
5. Klik **Deploy**.

---

### Opsi B: Deploy via Docker Compose di Coolify
1. Di Dashboard Coolify:
   - Klik **+ New Resource** -> **Docker Compose**.
   - Tempelkan isi dari berkas `docker-compose.yml`.
2. Klik **Deploy**.

---

## 🛠️ REST API Endpoints

| Method | Endpoint | Deskripsi | Auth Header |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Cek status & direktori penyimpanan | - |
| `POST` | `/api/bukti/upload` | Unggah berkas bukti (`multipart/form-data`) | `x-api-key: <KEY>` |
| `GET` | `/api/bukti/:koreksi_id/:filename` | Stream/tampilkan berkas (PDF/JPG/PNG) | - |
| `GET` | `/api/bukti/base64/:koreksi_id/:filename` | Ambil data base64 / Data URL berkas | `x-api-key: <KEY>` |
| `GET` | `/api/bukti/download/:koreksi_id/:filename`| Unduh berkas sebagai attachment | - |
| `DELETE`| `/api/bukti/:koreksi_id/:filename` | Hapus berkas fisik dari disk | `x-api-key: <KEY>` |

---

## 📂 Contoh Request Upload via cURL
```bash
curl -X POST http://<DOMAIN_ATAU_IP_SERVER>/api/bukti/upload \
  -H "x-api-key: <YOUR_API_KEY>" \
  -F "koreksi_id=019520b2-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  -F "file=@/path/to/scan_bukti.pdf"
```

Response JSON:
```json
{
  "success": true,
  "file_path": "bukti/019520b2-xxxx/1724119999_scan_bukti.pdf",
  "file_name": "scan_bukti.pdf",
  "file_type": "application/pdf",
  "file_size": 245120,
  "stored_filename": "1724119999_scan_bukti.pdf",
  "koreksi_id": "019520b2-xxxx",
  "url": "http://<DOMAIN_ATAU_IP_SERVER>/api/bukti/019520b2-xxxx/1724119999_scan_bukti.pdf",
  "uploaded_at": "2026-08-20T09:40:00.000Z"
}
```
