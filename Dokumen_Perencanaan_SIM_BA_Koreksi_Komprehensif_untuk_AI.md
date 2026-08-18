# DOKUMEN PERENCANAAN SISTEM & ARSITEKTUR TEKNIS — VERSI KOMPREHENSIF
# SIM-BA Koreksi BMD: Desktop Tracking Ekspedisi & Tanda Terima Tunggal BA Koreksi BMD

| Atribut | Nilai |
|---|---|
| Nama Sistem | SIM-BA Koreksi BMD |
| Target Platform | Desktop App (Windows 10/11 x64) |
| Unit Kerja | Subid Penatausahaan Aset BPKAD |
| Tech Stack | Tauri v2 (Rust) + React + TypeScript + Tailwind CSS + shadcn/ui + PostgreSQL |
| Alur Utama | 1x Cetak Ekspedisi (3 Kolom TTD) → Sirkulasi Fisik Manual → 1x Upload Bukti Lengkap → SELESAI |
| Tujuan Dokumen | Single source of truth untuk Local LLM / AI coding assistant (vibe coding) |
| Versi Dokumen | 2.0 (pengembangan dari v1.0, alur bisnis tidak berubah) |

---

## BAGIAN 0 — CARA MENGGUNAKAN DOKUMEN INI (UNTUK AI)

Dokumen ini dirancang agar dapat dibaca utuh oleh AI coding assistant lokal sebagai konteks penuh sebelum menulis kode. Aturan pembacaan:

1. **Baca berurutan dari Bagian 1 sampai Bagian 7.** Setiap bagian mereferensikan bagian sebelumnya.
2. **Alur bisnis di Bagian 2 dan 3 bersifat FINAL.** Jangan mengubah, menambah, atau mengurangi tahapan bisnis tanpa instruksi eksplisit dari user.
3. **Semua item bertanda `[ASUMSI]`** adalah keputusan teknis default yang dibuat untuk melengkapi dokumen v1.0. Item ini BOLEH diimplementasikan apa adanya, dan BOLEH disesuaikan jika user meminta, tetapi TIDAK BOLEH mengubah alur bisnis inti.
4. **Saat implementasi, kerjakan sesuai urutan Task di Bagian 5** (Task 1 → Task 4). Setiap task punya checklist Definition of Done.
5. **Konvensi penamaan yang dipakai konsisten di seluruh dokumen:**
   - Nama tabel/kolom database: `snake_case` (contoh: `koreksi_bmd`, `no_tu`).
   - Nama Tauri command (Rust): `snake_case` (contoh: `create_koreksi`).
   - Nama komponen React: `PascalCase` (contoh: `KoreksiFormDialog`).
   - Status berkas: enum persis `'MENUNGGU_BUKTI'` dan `'SELESAI'` (huruf besar, underscore).

---

## BAGIAN 1 — KONTEKS & GLOSARIUM

### 1.1 Konteks Organisasi

SIM-BA Koreksi BMD digunakan oleh **Subbidang Penatausahaan Aset, BPKAD** (Badan Pengelolaan Keuangan dan Aset Daerah) untuk melacak peredaran fisik **Berita Acara (BA) Koreksi BMD** (Barang Milik Daerah) yang memerlukan tanda tangan dan cap dari beberapa pihak sebelum dinyatakan selesai.

### 1.2 Glosarium Istilah

| Istilah | Arti dalam Dokumen Ini |
|---|---|
| BA / Berita Acara | Dokumen resmi Berita Acara Koreksi BMD yang menjadi objek pelacakan. |
| BMD | Barang Milik Daerah. |
| BPKAD | Badan Pengelolaan Keuangan dan Aset Daerah — pemilik sistem. |
| OPD | Organisasi Perangkat Daerah — unit pemohon koreksi (contoh: Dinas Pendidikan, RSUD). |
| OPD Pemohon / OPD Pengusul | OPD yang mengajukan BA koreksi; menerima 1 rangkap BA final di akhir proses. |
| TU BPKAD | Bagian Tata Usaha BPKAD; menerbitkan nomor surat dan tanda tangan pimpinan sebelum berkas masuk ke Bidang Aset. |
| No. TU (`no_tu`) | Nomor surat dari TU BPKAD yang sudah tertera pada berkas saat diterima user. |
| No. BA (`no_ba`) | Nomor Berita Acara Koreksi BMD. |
| Asman | Asisten Manajemen — persetujuan berupa TTD & Cap Kepala OPD Pemohon (Kolom 1). |
| Bidang Akuntansi | Bidang di BPKAD yang menerima 1 rangkap BA final (Kolom 2). |
| Bidang Aset | Bidang pengguna aplikasi ini; menyimpan 2 rangkap arsip. |
| Lembar Ekspedisi / Tanda Terima Tunggal | 1 lembar formulir cetak berisi detail BA + 3 kolom tanda tangan. Inilah artefak fisik yang disertai berkas selama sirkulasi. |
| Bukti Scan | File PDF/JPG/PNG hasil scan/foto lembar ekspedisi yang sudah lengkap 3 TTD & cap, diunggah 1x untuk menutup berkas. |
| User | Operator Subid Penatausahaan Aset BPKAD (single user per instalasi). |

---

## BAGIAN 2 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

### 2.1 Problem Statement

Proses verifikasi BA Koreksi BMD melibatkan **3 tahap serah terima fisik**:

1. Penyerahan berkas ke **OPD Pemohon** untuk dimintakan **Asman (TTD & Cap Kepala OPD)**.
2. Penyerahan **1 rangkap BA final** ke **Bidang Akuntansi**.
3. Penyerahan **1 rangkap BA final** ke **OPD Pemohon**.

Tanpa sistem, tidak ada cara cepat menjawab: *"Berkas BA nomor sekian sudah selesai atau masih beredar?"* dan *"Di mana bukti tanda terimanya?"*

### 2.2 Solusi (FINAL — tidak berubah dari v1.0)

Sistem menghasilkan **1 (satu) lembar formulir Tanda Terima Ekspedisi Tunggal** yang memuat **3 kolom tanda tangan sekaligus**. Berkas fisik berputar **di luar sistem secara manual**. Setelah ketiga pihak menandatangani dan mencap lembar fisik tersebut, user cukup melakukan **1x Upload Scan/Foto** ke aplikasi untuk menutup status berkas menjadi **SELESAI**.

Prinsip desain yang harus dijaga:

- **Satu berkas = satu baris data = satu lembar cetak = satu file bukti.** Tidak ada multi-upload, tidak ada multi-cetak per tahap.
- **Sistem tidak melacak posisi fisik per tahap.** Sistem hanya mencatat dua kondisi: sudah dicetak & menunggu bukti (`MENUNGGU_BUKTI`), atau bukti lengkap sudah diunggah (`SELESAI`).
- **Cetak terjadi tepat setelah input.** Tidak ada status "draft" terpisah; menyimpan data langsung dianggap siap cetak.

### 2.3 Tujuan (Goals) & Batasan (Non-Goals)

**Goals:**

1. Mencatat setiap BA koreksi yang masuk (No. TU, No. BA, OPD, tanggal, uraian).
2. Mencetak 1 lembar Tanda Terima Ekspedisi dengan 3 kolom TTD.
3. Menyimpan 1 file bukti scan per berkas.
4. Menampilkan status setiap berkas (MENUNGGU_BUKTI / SELESAI) beserta viewer bukti.

**Non-Goals (JANGAN dibangun):**

1. Tidak ada tracking posisi fisik per tahap / riwayat perpindahan berkas.
2. Tidak ada tanda tangan elektronik / digital.
3. Tidak ada multi-user, login, role, atau hak akses (single user desktop).
4. Tidak ada notifikasi, reminder, atau integrasi eksternal (email/WhatsApp/SIPD/dll).
5. Tidak ada upload bertahap per kolom TTD — hanya 1 file final.

### 2.4 Persona Pengguna

| Persona | Deskripsi |
|---|---|
| Operator Bidang Aset | Staf Subid Penatausahaan Aset BPKAD. Menerima berkas dari TU, menginput, mencetak, mengedarkan fisik, lalu mengupload bukti. Satu-satunya pengguna aplikasi. Tidak diasumsikan mahir teknis — UI harus sederhana dan satu layar utama. |

### 2.5 User Journey (Alur Kerja Operasional) — DETAIL

**Tahap 1: Input Data & Cetak 1x Lembar Ekspedisi**

1. User menerima berkas BA dari TU BPKAD. Berkas SUDAH memiliki No. Surat TU dan TTD Pimpinan BPKAD — user tidak mengurus itu.
2. User membuka aplikasi → klik tombol **"Tambah Koreksi"**.
3. User mengisi form:
   - No. Surat TU (`no_tu`)
   - No. BA Koreksi (`no_ba`)
   - OPD Pengusul (`opd_id`) — dipilih dari combobox live-search
   - Tanggal Surat (`tanggal_surat`) — default hari ini
   - Penjelasan/Uraian Koreksi (`penjelasan_koreksi`)
4. User menyimpan → sistem membuat record dengan status `MENUNGGU_BUKTI`.
5. User klik **CETAK** → sistem merender 1 lembar Tanda Terima Gabungan (3 kolom TTD) dan membuka dialog print OS.

**Tahap 2: Sirkulasi Berkas Fisik (DI LUAR SISTEM — tidak ada kode untuk ini)**

1. Berkas + lembar ekspedisi dibawa ke OPD Pemohon → Asman Kepala OPD menandatangani & mencap **Kolom 1**.
2. Berkas kembali ke Bidang Aset → dicap dinas BPKAD.
3. Berkas didistribusikan:
   - 1 rangkap BA final ke **Bidang Akuntansi** → tanda tangan **Kolom 2**.
   - 1 rangkap BA final ke **OPD Pemohon** → tanda tangan **Kolom 3**.
4. **2 rangkap arsip** disimpan di Bidang Aset.

**Tahap 3: 1x Upload Scan/Foto Bukti Selesai**

1. Lembar tanda terima fisik sudah berisi 3 tanda tangan & cap lengkap.
2. User men-scan/memfoto lembar tersebut (PDF/JPG/PNG).
3. Di aplikasi, user membuka baris berkas terkait → klik **"Upload Bukti"** → memilih file via file picker.
4. Sistem menyalin file ke storage aplikasi, menyimpan metadata file, dan mengubah status menjadi `SELESAI` beserta `uploaded_at`.
5. User dapat membuka kembali file bukti kapan pun via viewer internal.

### 2.6 Business Rules (BR)

| ID | Aturan |
|---|---|
| BR-01 | Satu record `koreksi_bmd` mewakili tepat satu berkas BA koreksi. |
| BR-02 | Status awal setiap record SELALU `MENUNGGU_BUKTI`. Tidak ada jalur lain untuk membuat record. |
| BR-03 | Status hanya berubah `MENUNGGU_BUKTI` → `SELESAI`, dan hanya melalui aksi upload bukti yang berhasil. Tidak ada transisi balik manual. |
| BR-04 | Satu record memiliki MAKSIMAL 1 file bukti. Upload ulang pada record `SELESAI` akan MENGGANTI file lama `[ASUMSI: file lama dihapus dari storage]`. |
| BR-05 | Record `SELESAI` tidak dapat dihapus `[ASUMSI — untuk menjaga jejak audit; record `MENUNGGU_BUKTI` boleh dihapus]`. |
| BR-06 | Cetak lembar ekspedisi boleh diulang kapan pun selama record ada (mis. lembar fisik rusak/hilang); cetak ulang TIDAK mengubah status. |
| BR-07 | Data master OPD bersifat referensial: OPD yang sudah dipakai oleh record koreksi TIDAK boleh dihapus (`ON DELETE RESTRICT`), hanya bisa dinonaktifkan (`is_active = FALSE`). |
| BR-08 | Format file bukti hanya PDF, JPG, atau PNG; ukuran maksimal 10 MB `[ASUMSI]`. |

---

## BAGIAN 3 — SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

### 3.1 Ringkasan Kebutuhan Fungsional

| ID | Fitur | Ringkasan |
|---|---|---|
| REQ-01 | Master Data OPD | Dropdown combobox daftar OPD pengusul dengan live search. |
| REQ-02 | Input Koreksi BMD | Form pencatatan: No. Surat TU, No. BA Koreksi, OPD Pengusul, Tanggal, Uraian Aset. |
| REQ-03 | Cetak Ekspedisi Tunggal | Cetak 1 lembar A4/F4 memuat detail BA dan 3 kolom TTD berdampingan (Asman OPD, Akuntansi, OPD Final). |
| REQ-04 | Upload Bukti Tunggal | Slot upload 1 file (PDF/JPG/PNG) lembar tanda terima yang sudah ber-TTD & cap lengkap. |
| REQ-05 | Tabel & Previewer | Tabel dengan badge status (MENUNGGU_BUKTI / SELESAI) dan viewer internal untuk file bukti. |

### 3.2 Detail Kebutuhan per Fitur

#### REQ-01 — Master Data OPD

- **Input**: teks pencarian (opsional).
- **Perilaku**:
  - Combobox menampilkan daftar OPD dari tabel `master_opd` yang `is_active = TRUE`, terurut alfabetis `nama_opd`.
  - Live search: memfilter daftar saat user mengetik, pencocokan case-insensitive terhadap `nama_opd` dan `singkatan`.
  - `[ASUMSI]` Jika OPD yang dicari belum ada, tersedia opsi "Tambah OPD baru" yang menyimpan nama OPD baru langsung dari combobox (inline create).
- **Output**: `opd_id` terpilih untuk dipakai form REQ-02.
- **Acceptance criteria**:
  1. Mengetik minimal 1 huruf memfilter daftar dalam < 200 ms untuk 200 OPD.
  2. OPD nonaktif tidak muncul di daftar.
  3. OPD baru yang dibuat inline langsung terpilih di form.

#### REQ-02 — Input Koreksi BMD

- **Form fields & validasi** (lihat juga 3.3):

| Field | Tipe UI | Wajib | Validasi |
|---|---|---|---|
| No. Surat TU (`no_tu`) | Text input | Ya | Non-kosong, maks 100 karakter. |
| No. BA Koreksi (`no_ba`) | Text input | Ya | Non-kosong, maks 100 karakter. `[ASUMSI]` Sistem memberi PERINGATAN (bukan blokir) jika `no_ba` sudah pernah dipakai record lain. |
| OPD Pengusul (`opd_id`) | Combobox (REQ-01) | Ya | Harus merujuk OPD aktif yang ada. |
| Tanggal Surat (`tanggal_surat`) | Date picker | Ya | Default `CURRENT_DATE`. `[ASUMSI]` Tidak boleh tanggal masa depan. |
| Uraian Koreksi (`penjelasan_koreksi`) | Textarea | Ya | Non-kosong. |

- **Perilaku**:
  - Tombol simpan: **"Simpan"** (tutup dialog, record muncul di tabel) dan **"Simpan & Cetak"** (simpan lalu langsung buka tampilan cetak REQ-03) `[ASUMSI — shortcut untuk alur dominan]`.
  - Setelah simpan berhasil, form reset dan toast sukses tampil.
  - `[ASUMSI]` Record yang masih `MENUNGGU_BUKTI` boleh diedit (untuk koreksi salah ketik) via tombol Edit di baris tabel. Record `SELESAI` bersifat read-only.
- **Output**: record baru `koreksi_bmd` berstatus `MENUNGGU_BUKTI`.
- **Acceptance criteria**:
  1. Field wajib kosong → tombol simpan nonaktif / pesan error per field.
  2. Record baru langsung tampil paling atas di tabel dengan badge kuning `MENUNGGU_BUKTI`.
  3. "Simpan & Cetak" membuka preview cetak dengan data yang baru disimpan.

#### REQ-03 — Cetak Ekspedisi Tunggal

- **Pemicu**: tombol "Cetak" di baris tabel, atau tombol "Simpan & Cetak" dari REQ-02.
- **Spesifikasi output**:
  - 1 lembar, ukuran A4 atau F4 `[ASUMSI: default A4 portrait, dapat diganti saat print dialog]`.
  - Teknik: komponen React khusus print (route/tersembunyi) + CSS `@media print` + `window.print()`, agar memanfaatkan print dialog native OS dari webview Tauri.
  - Konten layout: lihat spesifikasi lengkap di **Bagian 4.5**.
- **Perilaku**: cetak ulang kapan pun diizinkan, tidak mengubah status (BR-06).
- **Acceptance criteria**:
  1. Hasil cetak pas 1 halaman (tidak terpotong ke halaman 2).
  2. Ketiga kolom TTD tampil berdampingan dengan label: Kolom 1 "Asman Kepala OPD (TTD & Cap)", Kolom 2 "Bidang Akuntansi BPKAD", Kolom 3 "OPD Pemohon (Tanda Terima Final)".
  3. Semua data record (No. TU, No. BA, OPD, tanggal, uraian) tercetak benar.

#### REQ-04 — Upload Bukti Tunggal

- **Pemicu**: tombol "Upload Bukti" pada baris tabel (aktif untuk status apa pun; pada `SELESAI` berarti ganti file — BR-04).
- **Perilaku**:
  1. Membuka native file picker Tauri dengan filter: `PDF (*.pdf)`, `Gambar (*.jpg, *.jpeg, *.png)`.
  2. Validasi ukuran ≤ 10 MB dan ekstensi sesuai (BR-08) → gagal: toast error, tidak ada perubahan.
  3. File DISALIN ke folder storage aplikasi (Bagian 4.7) — bukan sekadar menyimpan path file asal, agar bukti tidak hilang jika file asal dipindah/dihapus.
  4. Update record: `file_path`, `file_name`, `file_type`, `uploaded_at = NOW()`, `status = 'SELESAI'`.
  5. `[ASUMSI]` Upload ulang pada record `SELESAI`: konfirmasi dulu ("Ganti bukti lama?"), lalu hapus file lama dari storage.
- **Output**: status berubah ke `SELESAI`, badge tabel berubah hijau.
- **Acceptance criteria**:
  1. Setelah upload sukses, badge berubah tanpa perlu refresh manual.
  2. File hasil copy ada di storage dan bisa dibuka via REQ-05 meski file asal dihapus.
  3. Upload file 15 MB / `.docx` ditolak dengan pesan jelas.

#### REQ-05 — Tabel & Previewer

- **Tabel utama** (TanStack Table + shadcn/ui):

| Kolom | Sumber | Catatan |
|---|---|---|
| No. BA | `no_ba` | — |
| No. Surat TU | `no_tu` | — |
| OPD | join `master_opd.nama_opd` | — |
| Tanggal | `tanggal_surat` | format `DD MMM YYYY` (id-ID) |
| Status | `status` | Badge: kuning `MENUNGGU_BUKTI`, hijau `SELESAI` |
| Aksi | — | Tombol: Cetak, Upload Bukti, Lihat Bukti (hanya jika file ada), Edit & Hapus (hanya `MENUNGGU_BUKTI`, BR-05) |

- **Perilaku tabel**:
  - Search global (mencari di `no_ba`, `no_tu`, nama OPD).
  - Filter status (Semua / MENUNGGU_BUKTI / SELESAI).
  - Urut default: `created_at DESC` (terbaru di atas).
  - `[ASUMSI]` Pagination 20 baris/halaman.
- **Previewer**:
  - Tombol "Lihat Bukti" membuka dialog viewer internal.
  - PDF → render via iframe/embed dari file lokal (atau buka dengan handler OS jika render internal sulit) `[ASUMSI: fallback `shell.open` Tauri]`.
  - JPG/PNG → render sebagai `<img>` di dialog, bisa zoom dasar.
- **Acceptance criteria**:
  1. Mengetik di search memfilter baris secara langsung.
  2. File bukti selalu bisa dibuka dari viewer tanpa aplikasi eksternal (untuk gambar) dan dengan fallback wajar (untuk PDF).
  3. Hapus record `MENUNGGU_BUKTI` meminta konfirmasi; record `SELESAI` tidak menampilkan tombol hapus.

### 3.3 State Machine Status

```
                [User simpan form REQ-02]
                          │
                          ▼
                ┌───────────────────┐
                │  MENUNGGU_BUKTI   │ ◄── aksi tersedia: Cetak, Edit, Hapus, Upload Bukti
                └───────────────────┘
                          │  Upload bukti SUKSES (REQ-04, satu-satunya jalur)
                          ▼
                ┌───────────────────┐
                │     SELESAI       │ ◄── aksi tersedia: Cetak, Lihat Bukti, Ganti Bukti
                └───────────────────┘     (read-only untuk Edit/Hapus)
```

Aturan: tidak ada transisi lain. Tidak ada cara mengembalikan `SELESAI` ke `MENUNGGU_BUKTI` dari UI (BR-03).

### 3.4 Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|---|---|---|
| NFR-01 | Platform | Windows 10/11 x64, distribusi sebagai installer Tauri (.msi / .exe NSIS). |
| NFR-02 | Database | PostgreSQL 15+ berjalan lokal di mesin yang sama `[ASUMSI: koneksi via `DATABASE_URL` di config/env; single database `sim_ba_koreksi`]`. |
| NFR-03 | Performa | Daftar 1.000 record termuat < 1 detik; live search combobox < 200 ms. |
| NFR-04 | Keandalan | File bukti disimpan di folder data aplikasi, terpisah dari file sumber; nama file unik (tidak menimpa). |
| NFR-05 | Usability | Satu layar utama (tabel + tombol tambah). Semua aksi lain via dialog/modal. Bahasa Indonesia di seluruh UI. |
| NFR-06 | Offline | Aplikasi bekerja penuh tanpa internet (DB lokal, tanpa layanan eksternal). |

### 3.5 Pesan Error Standar (Bahasa Indonesia)

| Kondisi | Pesan |
|---|---|
| Field wajib kosong | "{Nama Field} wajib diisi." |
| Tanggal masa depan | "Tanggal surat tidak boleh melebihi hari ini." |
| File terlalu besar | "Ukuran file melebihi 10 MB." |
| Tipe file salah | "Format file harus PDF, JPG, atau PNG." |
| Gagal koneksi DB | "Tidak dapat terhubung ke database. Periksa layanan PostgreSQL." |
| Gagal salin file | "Gagal menyimpan file bukti. Coba lagi." |
| Hapus OPD terpakai | "OPD ini sudah digunakan pada data koreksi dan tidak dapat dihapus. Nonaktifkan saja." |

---

## BAGIAN 4 — SYSTEM DESIGN DOCUMENT (SDD)

### 4.1 Arsitektur Tingkat Tinggi

```
┌──────────────────────────────────────────────────────────┐
│                 TAURI v2 DESKTOP APP                     │
│                                                          │
│  ┌────────────────────────┐   invoke/response (JSON)     │
│  │  FRONTEND (Webview)    │ ◄──────────────────────────► │
│  │  React + TS + Vite     │                              │
│  │  Tailwind + shadcn/ui  │   ┌────────────────────────┐ │
│  │  TanStack Table        │   │  BACKEND (Rust Core)   │ │
│  │  Print layout (A4)     │   │  Tauri Commands        │ │
│  └────────────────────────┘   │  File Storage Handler  │ │
│                               │  SQLx Pool ─────────┐  │ │
│                               └─────────────────────│──┘ │
└─────────────────────────────────────────────────────│────┘
                                                      ▼
                                          ┌────────────────────┐
                                          │ PostgreSQL (lokal) │
                                          │ db: sim_ba_koreksi │
                                          └────────────────────┘

Storage file bukti: {app_data_dir}/bukti/{koreksi_id}/{nama_file}
```

### 4.2 Struktur Folder Proyek (acuan implementasi)

```
sim-ba-koreksi/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── src/                          # Frontend React
│   ├── main.tsx
│   ├── App.tsx                   # Layout utama: header + halaman daftar
│   ├── pages/
│   │   └── KoreksiListPage.tsx   # Satu-satunya halaman utama
│   ├── components/
│   │   ├── KoreksiTable.tsx      # TanStack Table + toolbar (search, filter status)
│   │   ├── KoreksiFormDialog.tsx # REQ-02 (tambah/edit)
│   │   ├── OpdCombobox.tsx       # REQ-01
│   │   ├── StatusBadge.tsx       # Badge MENUNGGU_BUKTI / SELESAI
│   │   ├── UploadBuktiButton.tsx # REQ-04
│   │   ├── BuktiViewerDialog.tsx # REQ-05 viewer
│   │   └── print/
│   │       └── EkspedisiPrintSheet.tsx # REQ-03 layout cetak 1 lembar
│   ├── lib/
│   │   ├── api.ts                # wrapper invoke() per Tauri command
│   │   └── types.ts              # tipe TS mirror dari struct Rust
│   └── styles/print.css          # @media print, ukuran halaman A4
└── src-tauri/                    # Backend Rust
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── migrations/
    │   └── 0001_init.sql         # DDL Bagian 4.3
    └── src/
        ├── main.rs               # setup app, state DbPool, register commands
        ├── db.rs                 # inisialisasi sqlx PgPool
        ├── models.rs             # struct Opd, KoreksiBmd, dto request/response
        ├── commands/
        │   ├── opd.rs            # list_opd, create_opd
        │   ├── koreksi.rs        # CRUD koreksi
        │   └── bukti.rs          # upload_bukti, open_bukti
        └── storage.rs            # copy/hapus file ke app_data_dir
```

### 4.3 Skema Database PostgreSQL (DDL) — FINAL

```sql
-- Enum status tanda terima (hanya 2 nilai, jangan ditambah tanpa instruksi)
CREATE TYPE status_tanda_terima AS ENUM ('MENUNGGU_BUKTI', 'SELESAI');

-- Master data OPD (REQ-01)
CREATE TABLE master_opd (
    id          SERIAL PRIMARY KEY,
    nama_opd    VARCHAR(150) NOT NULL UNIQUE,
    singkatan   VARCHAR(50),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data koreksi BMD (satu baris = satu berkas BA)
CREATE TABLE koreksi_bmd (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_tu               VARCHAR(100) NOT NULL,                 -- No. Surat TU BPKAD
    no_ba               VARCHAR(100) NOT NULL,                 -- No. BA Koreksi
    opd_id              INT NOT NULL REFERENCES master_opd(id) ON DELETE RESTRICT,
    tanggal_surat       DATE NOT NULL DEFAULT CURRENT_DATE,
    penjelasan_koreksi  TEXT NOT NULL,
    status              status_tanda_terima NOT NULL DEFAULT 'MENUNGGU_BUKTI',
    -- Slot file bukti scan lengkap (maks 1 file, BR-04)
    file_path           TEXT,        -- path absolut di storage aplikasi
    file_name           VARCHAR(255),-- nama asli file untuk ditampilkan
    file_type           VARCHAR(50), -- application/pdf | image/jpeg | image/png
    uploaded_at         TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_koreksi_status ON koreksi_bmd(status);
CREATE INDEX idx_koreksi_opd    ON koreksi_bmd(opd_id);

-- [ASUMSI] Trigger agar updated_at selalu terbarui
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_koreksi_updated_at
BEFORE UPDATE ON koreksi_bmd
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Kamus data `koreksi_bmd`:**

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | UUID | Tidak | PK, generate otomatis `gen_random_uuid()`. |
| `no_tu` | VARCHAR(100) | Tidak | Nomor surat TU BPKAD dari berkas fisik. |
| `no_ba` | VARCHAR(100) | Tidak | Nomor Berita Acara koreksi. |
| `opd_id` | INT (FK) | Tidak | Referensi `master_opd.id`; `ON DELETE RESTRICT` (BR-07). |
| `tanggal_surat` | DATE | Tidak | Default hari input. |
| `penjelasan_koreksi` | TEXT | Tidak | Uraian aset/koreksi, tampil di lembar cetak. |
| `status` | ENUM | Tidak | Hanya `MENUNGGU_BUKTI` → `SELESAI` via upload (BR-02, BR-03). |
| `file_path` | TEXT | Ya | Terisi saat upload; path di `{app_data_dir}/bukti/...`. |
| `file_name` | VARCHAR(255) | Ya | Nama file asli untuk label di UI. |
| `file_type` | VARCHAR(50) | Ya | MIME type; menentukan mode render viewer. |
| `uploaded_at` | TIMESTAMPTZ | Ya | Waktu upload; ikut tercetak sebagai penanda selesai `[ASUMSI]`. |

### 4.4 Spesifikasi Tauri Commands (Kontrak API Backend ↔ Frontend)

Semua command dipanggil dari frontend via `invoke('nama_command', { ...args })`. Semua return `Result<T, String>` — pesan error string berbahasa Indonesia (lihat 3.5).

| # | Command | Argumen | Return | Keterangan |
|---|---|---|---|---|
| 1 | `list_opd` | `search: Option<String>` | `Vec<Opd>` | Hanya `is_active = TRUE`, urut `nama_opd`. Filter `ILIKE` pada nama/singkatan. |
| 2 | `create_opd` | `nama_opd: String, singkatan: Option<String>` | `Opd` | Untuk inline create dari combobox `[ASUMSI]`. Tolak duplikat nama. |
| 3 | `list_koreksi` | `search: Option<String>, status: Option<String>` | `Vec<KoreksiRow>` | Join nama OPD. Urut `created_at DESC`. |
| 4 | `get_koreksi` | `id: String (UUID)` | `KoreksiRow` | Untuk prefill form edit & preview cetak. |
| 5 | `create_koreksi` | `payload: CreateKoreksiDto` | `KoreksiRow` | Validasi server-side sesuai 3.2. Status selalu default. |
| 6 | `update_koreksi` | `id: String, payload: CreateKoreksiDto` | `KoreksiRow` | `[ASUMSI]` Tolak jika status sudah `SELESAI` (BR: read-only). |
| 7 | `delete_koreksi` | `id: String` | `()` | Tolak jika `SELESAI` (BR-05); jika ada file bukti, hapus juga dari storage. |
| 8 | `upload_bukti` | `id: String, source_path: String` | `KoreksiRow` | Validasi tipe/ukuran → salin ke storage → update 4 kolom file + `status='SELESAI'` + `uploaded_at`. Ganti file lama jika ada (BR-04). |
| 9 | `get_bukti_base64` | `id: String` | `String` (base64) | `[ASUMSI]` Untuk render gambar/PDF di viewer internal webview. Alternatif: `open_bukti` memakai `shell.open` ke handler OS. |

**DTO yang dipakai (mirror di `lib/types.ts`):**

```typescript
// lib/types.ts
export type StatusTandaTerima = 'MENUNGGU_BUKTI' | 'SELESAI';

export interface Opd {
  id: number;
  nama_opd: string;
  singkatan: string | null;
  is_active: boolean;
}

export interface CreateKoreksiDto {
  no_tu: string;
  no_ba: string;
  opd_id: number;
  tanggal_surat: string;       // 'YYYY-MM-DD'
  penjelasan_koreksi: string;
}

export interface KoreksiRow {
  id: string;                  // UUID
  no_tu: string;
  no_ba: string;
  opd_id: number;
  nama_opd: string;            // hasil join master_opd
  tanggal_surat: string;
  penjelasan_koreksi: string;
  status: StatusTandaTerima;
  file_name: string | null;
  file_type: string | null;
  uploaded_at: string | null;
  created_at: string;
}
```

### 4.5 Spesifikasi Lembar Cetak Ekspedisi (REQ-03)

Satu halaman A4/F4, seluruhnya teks hitam putih (dokumen dinas). Urutan vertikal:

```
┌────────────────────────────────────────────────────────────┐
│  [KOP DINAS BPKAD — logo + nama instansi, [ASUMSI: teks    │
│   "BADAN PENGELOLAAN KEUANGAN DAN ASET DAERAH" + alamat,   │
│   garis pembatas ganda di bawah kop]]                      │
│                                                            │
│        TANDA TERIMA EKSPEDISI                              │
│        BERITA ACARA KOREKSI BARANG MILIK DAERAH            │
│        Nomor BA: {no_ba}                                   │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Tabel informasi (2 kolom label–isi):                 │  │
│  │  No. Surat TU BPKAD : {no_tu}                        │  │
│  │  No. BA Koreksi     : {no_ba}                        │  │
│  │  OPD Pengusul       : {nama_opd}                     │  │
│  │  Tanggal Surat      : {tanggal_surat, DD MMMM YYYY}  │  │
│  │  Uraian Koreksi     : {penjelasan_koreksi}           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────┬─────────────┬─────────────┐               │
│  │  KOLOM 1    │  KOLOM 2    │  KOLOM 3    │  ← 3 kolom   │
│  │ Asman       │ Bidang      │ OPD Pemohon │    berdamping│
│  │ Kepala OPD  │ Akuntansi   │ (Tanda      │    (table    │
│  │ (TTD & Cap) │ BPKAD       │  Terima)    │    3 sel)    │
│  │             │             │             │              │
│  │  (ruang     │  (ruang     │  (ruang     │  ← ±6 cm     │
│  │   kosong    │   kosong    │   kosong    │    untuk TTD │
│  │   TTD+cap)  │   TTD+cap)  │   TTD+cap)  │    & cap     │
│  │             │             │             │              │
│  │ Nama: _____ │ Nama: _____ │ Nama: _____ │              │
│  │ NIP : _____ │ NIP : _____ │ NIP : _____ │              │
│  │ Tgl : _____ │ Tgl : _____ │ Tgl : _____ │              │
│  └─────────────┴─────────────┴─────────────┘              │
│                                                            │
│  Catatan kaki: "Arsip BA final: 2 rangkap disimpan di      │
│  Bidang Aset BPKAD."                                       │
└────────────────────────────────────────────────────────────┘
```

Aturan implementasi cetak:

- Komponen `EkspedisiPrintSheet` dirender off-screen/route khusus, lalu `window.print()`.
- `print.css` berisi `@page { size: A4; margin: 15mm; }`, sembunyikan seluruh UI aplikasi (`body * { display: none }` kecuali area cetak).
- Wajib lolos AC REQ-03: pas 1 halaman.

### 4.6 Spesifikasi UI (Wireframe Layar Utama)

```
┌──────────────────────────────────────────────────────────────┐
│ SIM-BA Koreksi BMD                          [Desktop window] │
│ Subid Penatausahaan Aset — BPKAD                             │
├──────────────────────────────────────────────────────────────┤
│ [🔍 Cari No. BA / No. TU / OPD...]  [Status: Semua ▾]       │
│                                              [+ Tambah Koreksi]│
├──────────────────────────────────────────────────────────────┤
│ No. BA   │ No. TU   │ OPD      │ Tanggal │ Status │ Aksi    │
│──────────┼──────────┼──────────┼─────────┼────────┼─────────│
│ 001/BA.. │ 090/TU.. │ Dinas    │ 12 Agu  │[MENUN- │[Cetak]  │
│          │          │ Pendidik │  2026   │ GGU... │[Upload] │
│          │          │          │         │        │[Edit][🗑]│
│──────────┼──────────┼──────────┼─────────┼────────┼─────────│
│ 002/BA.. │ 091/TU.. │ RSUD     │ 10 Agu  │[SELESAI│[Cetak]  │
│          │          │          │  2026   │  hijau]│[Lihat]  │
│          │          │          │         │        │[Ganti]  │
└──────────────────────────────────────────────────────────────┘
```

Prinsip: satu layar utama; Tambah/Edit = dialog; Viewer bukti = dialog; Cetak = preview singkat lalu print dialog OS.

### 4.7 Konvensi Penyimpanan File Bukti

- Root: direktori data aplikasi Tauri (`app_data_dir`, mis. `C:\Users\{user}\AppData\Roaming\sim-ba-koreksi\`).
- Pola path: `bukti/{koreksi_id}/{timestamp}_{nama_file_asli_yang_disanitasi}`.
  - Sanitasi: lowercase, spasi → `_`, hapus karakter selain `[a-z0-9._-]`.
  - Contoh: `bukti/3f8a...c1/20260818_093015_bukti_ba_001_2026.pdf`.
- Kepemilikan file ada pada aplikasi: jangan pernah menyimpan path ke lokasi asal user.

### 4.8 Konfigurasi & Environment

| Item | Nilai / Mekanisme |
|---|---|
| Koneksi DB | Env `DATABASE_URL`, contoh `postgresql://postgres:postgres@localhost:5432/sim_ba_koreksi` `[ASUMSI]`. |
| Migrasi | `sqlx::migrate!()` dijalankan saat startup app (folder `src-tauri/migrations`). |
| State Tauri | `PgPool` dibuat sekali di `main.rs`, dibagikan via `tauri::Manager::state`. |
| Versi acuan | Tauri v2.x, React 18, Vite 5+, Tailwind 3, shadcn/ui (terbaru), TanStack Table v8, SQLx 0.8, PostgreSQL 15+. |

---

## BAGIAN 5 — TASK BREAKDOWN & IMPLEMENTATION ROADMAP

Kerjakan berurutan Task 1 → 4. Jangan melompat task sebelum checklist task sebelumnya selesai.

### Task 1 — Backend Tauri & Database

**Cakupan:** setup koneksi SQLx PostgreSQL pool dan Tauri commands: CRUD koreksi dan upload file bukti.

Checklist:
- [ ] Scaffold proyek Tauri v2 + React + TS + Tailwind + shadcn/ui sesuai struktur 4.2.
- [ ] Buat database `sim_ba_koreksi` dan jalankan migrasi `0001_init.sql` (DDL 4.3).
- [ ] `db.rs`: inisialisasi `PgPool` dari `DATABASE_URL`, daftarkan sebagai Tauri state.
- [ ] Implementasi command 1–9 (Bagian 4.4) lengkap dengan validasi server-side dan pesan error 3.5.
- [ ] `storage.rs`: fungsi copy file (buat subfolder per `koreksi_id`), sanitasi nama, hapus file.
- [ ] Uji tiap command lewat frontend sementara / Tauri devtools.

### Task 2 — Frontend Table & Form

**Cakupan:** modal input shadcn/ui dan TanStack Table dengan filter search dan status badge.

Checklist:
- [ ] `KoreksiListPage` + `KoreksiTable`: kolom sesuai 3.2 REQ-05, urut `created_at DESC`, pagination.
- [ ] Search global + filter status + `StatusBadge` (kuning/hijau).
- [ ] `KoreksiFormDialog`: form tambah/edit dengan validasi client-side sesuai tabel REQ-02; tombol "Simpan" dan "Simpan & Cetak".
- [ ] `OpdCombobox`: live search + inline create OPD baru `[ASUMSI]`.
- [ ] Konfirmasi hapus; tombol Edit/Hapus disembunyikan untuk status `SELESAI`.

### Task 3 — Template Cetak 1 Lembar

**Cakupan:** komponen React print layout 1 lembar A4 dengan 3 kolom tanda tangan dinas.

Checklist:
- [ ] `EkspedisiPrintSheet` sesuai spesifikasi 4.5 (kop, judul, tabel info, 3 kolom TTD, catatan kaki).
- [ ] `print.css`: `@page` A4, hide UI non-cetak, pas 1 halaman.
- [ ] Pemicu cetak dari tombol baris tabel dan "Simpan & Cetak".
- [ ] Uji cetak nyata ke printer/PDF: tidak terpotong, 3 kolom sejajar.

### Task 4 — Upload & File Previewer

**Cakupan:** integrasi native file picker Tauri, storage handler, dan dialog viewer PDF/Gambar.

Checklist:
- [ ] `UploadBuktiButton`: file picker (filter pdf/jpg/png) → `upload_bukti` → refresh tabel, badge jadi hijau.
- [ ] Validasi ukuran & tipe dengan pesan error 3.5.
- [ ] `BuktiViewerDialog`: gambar via base64 (command 9); PDF via base64 embed atau fallback `shell.open` `[ASUMSI]`.
- [ ] Ganti bukti pada `SELESAI` dengan konfirmasi; file lama terhapus dari storage.
- [ ] Uji ketahanan: hapus file sumber setelah upload → viewer tetap bisa membuka bukti.

---

## BAGIAN 6 — DEFINITION OF DONE & CHECKLIST UJI PENERIMAAN

Aplikasi dianggap selesai jika SEMUA skenario berikut lulus di Windows 10/11:

| # | Skenario Uji | Hasil yang Diharapkan |
|---|---|---|
| T-01 | Tambah koreksi lengkap lalu "Simpan & Cetak" | Record tampil di tabel berstatus MENUNGGU_BUKTI; lembar cetak terbuka dan pas 1 halaman A4. |
| T-02 | Simpan form dengan field wajib kosong | Ditolak dengan pesan error per field. |
| T-03 | Ketik sebagian nama OPD di combobox | Daftar terfilter; pilih OPD → `opd_id` terisi. |
| T-04 | Upload bukti PDF 3 MB | Status → SELESAI (badge hijau), `uploaded_at` terisi, file tersalin ke storage. |
| T-05 | Upload file `.docx` / file 15 MB | Ditolak dengan pesan 3.5; status tidak berubah. |
| T-06 | Hapus file sumber di folder asal, lalu "Lihat Bukti" | Viewer tetap menampilkan bukti dari storage aplikasi. |
| T-07 | Upload ulang pada record SELESAI | Konfirmasi muncul; file baru menggantikan file lama. |
| T-08 | Coba hapus record SELESAI | Tidak ada tombol hapus / ditolak (BR-05). |
| T-09 | Cetak ulang record SELESAI | Lembar cetak tampil normal; status tetap SELESAI (BR-06). |
| T-10 | Restart aplikasi | Seluruh data & status persisten; koneksi DB otomatis. |

---

## BAGIAN 7 — RINGKASAN EKSEKUTIF (untuk prompt singkat ke AI)

> Bangun aplikasi desktop **SIM-BA Koreksi BMD** (Windows, Tauri v2 + React + TS + Tailwind + shadcn/ui + PostgreSQL lokal via SQLx). Fungsi inti: (1) form input BA koreksi (`no_tu`, `no_ba`, combobox OPD live-search, tanggal, uraian) yang saat disimpan berstatus `MENUNGGU_BUKTI`; (2) cetak 1 lembar A4 "Tanda Terima Ekspedisi" berisi detail BA + 3 kolom TTD berdampingan (Asman Kepala OPD / Bidang Akuntansi BPKAD / OPD Pemohon); (3) upload 1 file bukti scan (PDF/JPG/PNG ≤ 10 MB) yang disalin ke `app_data_dir/bukti/{id}/` dan mengubah status menjadi `SELESAI`; (4) tabel TanStack dengan search, filter status, badge, viewer bukti internal. Satu layar utama, single user, tanpa login, tanpa tracking tahap fisik. Skema DB, kontrak Tauri command, dan aturan bisnis lengkap mengikuti dokumen ini.

---

*Akhir dokumen. Versi 2.0 — alur bisnis identik dengan v1.0; penambahan bersifat detelisasi teknis untuk kebutuhan Local LLM & vibe coding.*
