---
name: SIMBASI BMD
description: Sistem Informasi Manajemen Sirkulasi Berita Acara Koreksi BMD Kota Magelang
colors:
  primary: "#4f46e5"
  primary-hover: "#4338ca"
  neutral-bg: "#f8fafc"
  neutral-card: "#ffffff"
  neutral-text: "#0f172a"
  neutral-muted: "#64748b"
  neutral-border: "#e2e8f0"
  success: "#059669"
  warning: "#d97706"
  danger: "#dc2626"
typography:
  display:
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
---

# Design System: SIMBASI BMD

## Overview

**Creative North Star: "Aparatur Presisi & Keteraturan Arsip"**

SIMBASI BMD adalah instrumen kerja desktop resmi Pemerintah Kota Magelang. Antarmuka mengutamakan keterbacaan data berkas berdensitas tinggi, kontras yang tajam, tata letak yang stabil, dan hierarki informasi yang teratur tanpa ornamen visual buatan yang berlebihan.

Setiap elemen dirancang untuk mendukung alur kerja cepat operator aset daerah: pencatatan nomor dinas, verifikasi berkas, pencetakan lembar tanda terima resmi, dan penelusuran status sirkulasi.

**Key Characteristics:**
- Tipografi Segoe UI Variable yang bersih dan terintegrasi mulus dengan lingkungan desktop Windows.
- Palet warna fungsional: aksen Indigo institusional dengan indikator status Emerald (Selesai) dan Amber (Menunggu Bukti).
- Struktur permukaan padat dan terdefinisi dengan border subtil, menghindari efek blur dekoratif atau bayangan difus yang tidak perlu.
- Penggunaan ruang yang efisien untuk tabel data panjang dan panel dialog formulir.

## Colors

Palet warna menggunakan pendekatan institusional modern dengan kontras tinggi untuk mode terang dan gelap.

### Primary
- **Gov Indigo** (`#4f46e5`): Digunakan secara selektif untuk tombol aksi utama (*Call to Action*), fokus input, dan penanda identitas dinas.

### Neutral
- **Slate Deep Canvas** (`#0f172a` / `#f8fafc`): Latar belakang kerja dengan kontras tinggi untuk teks utama.
- **Card Surface** (`#ffffff` / `#0f172a`): Latar belakang kartu KPI, tabel berkas, dan jendela modal dialog.
- **Slate Text Muted** (`#64748b` / `#94a3b8`): Teks sekunder, label metadata, dan penjelas status.
- **Subtle Divider** (`#e2e8f0` / `#1e293b`): Garis batas struktur tabel dan pemisah kolom.

### Semantic Status
- **Verified Emerald** (`#059669`): Menandakan berkas berstatus `SELESAI` (bukti lengkap terarsip).
- **Pending Amber** (`#d97706`): Menandakan berkas berstatus `MENUNGGU_BUKTI` (dalam sirkulasi fisik).
- **Destructive Red** (`#dc2626`): Aksi penghapusan berkas atau pembersihan data fisik.

### Named Rules
**The Purposeful Accent Rule.** Warna aksen primer digunakan secara hemat pada ≤10% area layar agar perhatian pengguna terpusat pada baris data dan alur tindakan.

## Typography

**Body & Display Font:** `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif`  
**Mono Font:** `ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace`

**Character:** Tipografi desktop formal, presisi, memiliki *x-height* optimal, dan sangat mudah dibaca pada tabel dengan banyak baris dan angka dinas.

### Hierarchy
- **Display** (800, 1.25rem / 20px, 1.2): Judul halaman aplikasi dan header utama.
- **Headline** (700, 1.125rem / 18px, 1.3): Judul seksi modal dialog dan ringkasan KPI.
- **Title** (600, 0.875rem / 14px, 1.4): Header kolom tabel, label formulir, dan tombol utama.
- **Body** (400, 0.8125rem / 13px, 1.5): Teks isi sel data tabel, nomor BA, nama instansi OPD, dan paragraf.
- **Label** (600, 0.6875rem / 11px, 1.4): Teks badge status dan tag instansi (tidak boleh di bawah 11px).

### Named Rules
**The Readable Scale Rule.** Seluruh teks fungsional memiliki ukuran minimal 11px (0.6875rem) untuk menjamin keterbacaan pada layar resolusi tinggi.

## Layout

Model tata letak berbasis desktop viewport terstruktur:
- Header institusional permanen dengan logo resmi Kota Magelang, navigasi cadangan, ekspor, dan indikator koneksi PostgreSQL.
- Area konten utama berpusat pada container `max-w-7xl` dengan padding konsisten (`p-6`).
- Grid KPI 3 kolom responsif di atas tabel data operasional.
- Modal dialog terpusat dengan scroll internal untuk pratinjau bukti dan pengisian formulir.

## Elevation & Depth

Sistem mengadopsi prinsip *flat tonal layering* dengan kedalaman berbasis kontras border dan bayangan ambient lembut (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`).

### Named Rules
**The Clean Surface Rule.** Tidak menggunakan efek kaca (*glassmorphism*) buram yang berlebihan; kontras visual dicapai melalui pemisahan warna permukaan dan border 1px yang tegas.

## Shapes

- Radius Kartu & Modal: `rounded-xl` (12px) untuk sudut kontainer utama.
- Radius Tombol & Input: `rounded-lg` (8px) untuk komponen interaktif.
- Radius Status Badge: `rounded-full` (9999px) berbentuk pil padat dengan dot indikator warna status.

## Components

### Buttons
- **Primary:** Background Indigo (`#4f46e5`), teks putih, padding 8px 16px, radius 8px, transisi warna halus pada *hover*.
- **Secondary / Outline:** Background putih/gelap dengan border slate 1px, teks netral, hover slate-50/slate-800.
- **Icon Action Group:** Tombol aksi pada tabel dikelompokkan secara rapi dengan ikon Lucide berukuran proporsional (14-16px).

### Status Badges
- **Selesai:** Background Emerald muda (10% tint), border emerald, teks emerald tua, dengan dot hijau solid.
- **Menunggu Bukti:** Background Amber muda (10% tint), border amber, teks amber tua, dengan dot amber solid.

### Data Tables
- Header tabel netral tebal (`font-semibold text-slate-700 dark:text-slate-200`) dengan border bawah terstruktur.
- Garis baris sel bersih dengan hover highlight halus untuk kenyamanan scanning visual.

## Do's and Don'ts

### Do:
- **Do** gunakan format tanggal dinas Indonesia (`dd MMMM yyyy`) yang konsisten.
- **Do** pertahankan kontras rasio minimal 4.5:1 untuk semua teks fungsional.
- **Do** sertakan konfirmasi eksplisit sebelum tindakan penghapusan berkas fisik atau basis data.
- **Do** pastikan lembar cetak mematuhi standar kop surat dinas Pemerintah Kota Magelang.

### Don't:
- **Don't** gunakan gradien ungu-biru neon (*purple gradient slop*) pada elemen UI.
- **Don't** gunakan font generik AI yang overused ketika sistem font Windows asli lebih presisi dan konsisten.
- **Don't** gunakan border aksen tebal 4px pada satu sisi kartu (*side-tab card tell*).
- **Don't** tumpuk kotak ikon besar di atas judul kecil (*icon tile stack*).
- **Don't** gunakan ukuran teks fungsional di bawah 11px.
