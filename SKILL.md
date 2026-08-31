---
name: simbasi-ui
description: Alur & resep desain UI/UX aplikasi SIMBASI BMD (desktop Tauri + React 19 + Tailwind). Gunakan skill ini setiap kali menambah/mengubah tampilan — halaman, tabel, dialog, KPI, badge, toast, lembar cetak — agar hasilnya seirama dengan karakter visual aplikasi: institusional, padat-data, presisi, bebas ornamen generik AI.
---

# SKILL — Desain UI/UX SIMBASI BMD

**Karakter:** *"Aparatur Presisi & Keteraturan Arsip."* Aplikasi desktop resmi BPKAD Kota Magelang. Tampilannya indah bukan karena ornamen, melainkan karena **kebersihan struktur**: hierarki jelas, kontras tajam, warna aksen yang hemat, dan detail yang konsisten di semua layar — light maupun dark mode.

Aturan emas: **ketelitian mengalahkan dekorasi.** Setiap elemen baru harus terlihat seperti bagian yang memang sudah ada sejak hari pertama.

---

## Ringkasan Alur (TL;DR)

Urutan kerja setiap kali membangun/mengubah tampilan:

1. **Fondasi** — pakai stack font, radius, dan palet yang sudah ada. Jangan memperkenalkan token/font/palet baru (lihat §1).
2. **Shell** — semua konten hidup di dalam `main` berpusat `max-w-7xl px-6`; header institusional di `App.tsx` tidak disentuh sembarangan (lihat §2).
3. **Komposisi halaman** — urutan vertikal tetap: *Page Head → KPI Grid → Toolbar (cari/filter) → Kartu Tabel → Pagination* (lihat §3).
4. **Komponen** — rakit dari resep kelas yang sudah mapan: tombol, input, badge, chip, kartu (lihat §4).
5. **Semantik status** — Emerald = selesai, Amber = menunggu bukti, Red = destruktif saja; aksen indigo ≤10% layar (lihat §5).
6. **State** — setiap view wajib punya: loading, error (+retry), empty (+CTA), dan toast hasil aksi (lihat §6).
7. **Dialog & cetak** — modal pakai pola backdrop-blur + kartu `rounded-2xl`; lembar dinas pakai portal cetak putih A4 (lihat §7).
8. **Poles akhir** — pair `dark:` di SETIAP permukaan, cek kontras, pastikan teks ≥11px, motion hanya `transition-colors`/spin/toast, lalu jalankan checklist anti-slop §8.

---

## Map File — sentuh file yang benar

| File | Peran |
|---|---|
| `src/styles/index.css` | Token HSL shadcn-style (primary indigo, success, warning) + font keluarga `body`. Sumber kebenaran token. |
| `tailwind.config.js` | Memetakan token `var(--…)` ke kelas Tailwind; `darkMode: "class"`. |
| `src/styles/print.css` | Isolasi `@media print` — hanya `.print-overlay-root` yang tercetak. |
| `src/lib/theme.ts` | `useTheme()` — dark/light, tersimpan `localStorage`, default mengikuti `prefers-color-scheme`. |
| `src/lib/utils.ts` | `cn()` (clsx + tailwind-merge) — gunakan untuk menggabungkan kelas kondisional. |
| `src/App.tsx` | Shell: header institusional + `main` + modal tingkat aplikasi + sheet cetak. |
| `src/pages/KoreksiListPage.tsx` | Contoh halaman utama: head, KPI, toolbar, tabel, state, hotkey, toast. |
| `src/components/KoreksiTable.tsx` | Contoh tabel data lengkap: filter, pagination, aksi per baris, menu floating. |
| `src/components/*Dialog.tsx` | Pola dialog: form, konfirmasi hapus, viewer, sumber unggah, pengaturan. |
| `src/components/print/*.tsx` | Lembar dinas: kop resmi, tabel info, 3 kolom tanda tangan, rekapitulasi. |
| `DESIGN.md` | Sistem desain terekam (warna, tipografi, aturan bernama, Do's/Don'ts). |
| `PRODUCT.md` | Konteks produk: siapa pengguna, prinsip, komitmen brand. |

---

## 1. Fondasi Token & Tema

**Font** — native Windows, bukan web font:
```css
"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif
```
- Nomor dinas & angka identik (`no_ba`, `no_tu`) selalu **monospace**: `font-mono` (`ui-monospace, "Cascadia Code", "Segoe UI Mono"`) — memberi kesan "nomor resmi yang bisa di-cross-check".

**Palet** — komponen memakai skala Tailwind langsung dengan pasangan `dark:` (disiplin ini yang sebenarnya menjaga konsistensi; token di `index.css` adalah lapis kompatibilitas):

| Peran | Light | Dark |
|---|---|---|
| Kanvas | `bg-slate-50` | `dark:bg-slate-950` |
| Kartu / permukaan | `bg-white` | `dark:bg-slate-900` (deep: `dark:bg-slate-950` utk input) |
| Border | `border-slate-200` | `dark:border-slate-800` |
| Teks utama | `text-slate-900` | `dark:text-white` / `dark:text-slate-100` |
| Teks sekunder | `text-slate-500` | `dark:text-slate-400` |
| Aksen primer | `bg-indigo-600` / `text-indigo-600` | `dark:bg-indigo-600` / `dark:text-indigo-400` |
| Selesai (emerald) | `emerald-50/200/600/700` | `dark:emerald-950/800/400/300` |
| Menunggu (amber) | `amber-50/200/600/800` | `dark:amber-950/900/300` |
| Destruktif | `red-50/200/600/700` | `dark:red-950/800/400/300` |

**Radius:** kartu & modal `rounded-xl`/`rounded-2xl` (12–16px) · kontrol `rounded-lg` (8px) · badge/pil `rounded-full`.
**Elevasi:** `shadow-sm` untuk kartu & tombol · `shadow-2xl` hanya untuk modal & popup. Kedalaman datang dari **border 1px + beda tonalitas permukaan**, bukan bayangan besar.

**Dark mode** — dua lapis yang harus selalu sinkron:
1. `useTheme()` men-set class `dark` di `<html>` + `colorScheme` (menyimpan preferensi).
2. Setiap elemen baru **wajib** ditulis dengan pasangan `dark:` — audit cepat: cari elemen yang punya `bg-white`/`text-slate-900` tanpa `dark:` dan tambahkan.

**Transisi tema** terasa halus karena shell memakai `transition-colors duration-200`; komponen baru ikuti pola itu.

---

## 2. Shell Aplikasi (`App.tsx`)

Struktur yang tidak boleh dipecah:

```tsx
<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 transition-colors duration-200 antialiased">
  <header className="sticky top-0 z-30 border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm"> … </header>
  <main className="flex-1 px-6 py-6 mx-auto w-full max-w-7xl"> …halaman… </main>
  {/* modal & print sheet tingkat aplikasi, di-render kondisional */}
</div>
```

- **Header institusional**: logo + "SIMBASI BMD" + badge `KOTA MAGELANG` (pill indigo, uppercase, `tracking-wider`) + sub-judul dinas. Kanan: grup aksi outline (Ekspor, Cadangan, Koneksi, tema, CMD) + **pill status database** dengan titik hijau menyala (`shadow-[0_0_6px_rgba(16,185,129,0.6)]`).
- **Label tombol menyusut, ikon bertahan**: teks dibungkus `<span className="hidden lg:inline">` sehingga di lebar sempit tombol tetap rapi sebagai ikon.
- **Modal di-manage sebagai state di `App`/page** (`open: boolean` + `target: Row | null`), bukan kondisi ad-hoc di dalam komponen anak. Aksi berat lewat `onSaved/onRestored` → `refreshKey` untuk me-refresh data.

---

## 3. Pola Komposisi Halaman (`KoreksiListPage.tsx`)

Urutan vertikal tetap, dibungkus `space-y-6`:

1. **Page head** — kiri: `h1 text-xl font-black tracking-tight` + subtitle `text-xs` muted; kanan: tombol sekunder (Segarkan) + **satu tombol primer** (`bg-indigo-600`). Hanya satu tombol primer per layar.
2. **KPI grid** — `grid grid-cols-1 sm:grid-cols-3 gap-4`; tiap kartu: border + tint semantik 10% (`bg-amber-50/40`, `bg-emerald-50/40`), chip ikon 8×8 `rounded-xl` di kanan atas, angka `text-2xl font-black`. Kartu pertama netral (indigo), kartu status mengikuti warna semantiknya.
3. **Toolbar** — satu kartu berisi: input search (ikon `Search` melekat kiri, `focus:ring-2 focus:ring-indigo-500/20`, tombol ✕ kecil saat ada isi) + **pill filter segmen** dengan jumlah (`Semua (12) / Menunggu Bukti (7) / Selesai (5)`; yang aktif = `bg-white shadow-sm font-semibold`) + hitungan hasil di kanan.
4. **Kartu tabel** → 5. **Footer pagination** di dalam kartu yang sama (border-t, `bg-slate-50/50`).

---

## 4. Resep Komponen

### Tombol
```tsx
// Primer — satu per layar
"rounded-lg bg-indigo-600 px-3 sm:px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow"
// Sekunder / outline
"rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
// Aksi ikon tabel — kotak 32px
"h-8 w-8 inline-flex items-center justify-center rounded-lg border … shadow-sm transition-colors"
```
Semua tombol aksi punya `title` (tooltip) dan ikon `lucide` 14–16px (`h-4 w-4`). Loading = ganti isi dengan `RefreshCw animate-spin`, tombol tetap berukuran sama.

### Input & Field
```tsx
const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-colors";
```
Pakai komponen `Field` (lihat `KoreksiFormDialog.tsx`): label `text-xs font-bold` + ikon `Info` kecil dengan tooltip hover (`group-hover:opacity-100`) untuk hint + pesan error `text-red-600` di bawah. Validasi: sinkron saat submit + **asinkron saat blur** (cek nomor duplikat) + auto-format nomor dinas (`000.2.3.2/[n]/440`) dengan chip bantuan kecil `Sparkles "Format"`.

### Status Badge (`StatusBadge.tsx`)
Pill padat: `rounded-full px-2.5 py-0.5 text-xs font-semibold` + latar tint 10% + border + **titik 6px menyala** (`h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]`). Status = fakta data, bukan dekorasi.

### Kartu Tabel
- `thead`: `bg-slate-50/80 text-xs font-semibold uppercase tracking-wider` — kecil, tebal, jernih.
- Baris: `divide-y divide-slate-100 dark:divide-slate-800/80`, hover `hover:bg-indigo-50/30 dark:hover:bg-slate-800/40`, sel `whitespace-nowrap` untuk kolom nomor.
- **Sel dua baris**: baris utama `font-medium` + baris kedua `text-xs text-slate-400 truncate` dengan `title` (untuk isi panjang seperti uraian).
- **Aksi baris**: grup ikon kompak; aksi kontekstual ikut warna status (Unggah = indigo saat menunggu, Lihat = emerald saat selesai). Aksi melimpah (edit, ganti bukti, hapus) masuk ke **menu "•••" floating via `createPortal`** — dihitung dari `getBoundingClientRect()`, dibuka ke atas saat dekat tepi bawah, `shadow-2xl`, tutup saat klik-luar/scroll/resize. Menu tidak pernah terpotong tabel.
- **Empty state**: lingkaran ikon 56px + judul + kalimat penjelas + CTA yang kontekstual (ada filter → "Reset Filter"; kosong beneran → primer "Tambah … Pertama").
- **Pagination**: teks "Halaman X dari Y" + tombol Sebelumnya/Selanjutnya, `disabled:opacity-40`.

---

## 5. Semantik Status & Aturan Warna

- **Emerald** = `SELESAI` (bukti terekam). **Amber** = `MENUNGGU_BUKTI` (beredar fisik). **Red** = destruktif & error **saja** — tidak boleh dipakai untuk hiasan.
- **The Purposeful Accent Rule**: indigo primer ≤10% layar. Biarkan netral yang bekerja; aksen menunjuk, bukan menghias.
- Aksi per baris **mengikuti status data** (warna, keaktifan, bahkan apakah tombol muncul) — tabel harus bisa dibaca sekilas tanpa membuka dialog.
- Kontras minimal 4,5:1 untuk semua teks fungsional; tanggal dinas konsisten `dd MMMM yyyy` (`formatTanggal`).

---

## 6. State, Feedback & Keyboard

Setiap view data wajib lengkap:

| State | Resep |
|---|---|
| Loading | Spinner `h-8 w-8 border-4 border-indigo-600 border-t-transparent animate-spin` + kalimat `text-sm font-medium`. |
| Error | Kartu merah: ikon `AlertCircle` + judul `font-bold` + detail + tombol **Coba Lagi** (primer merah). |
| Empty | Pola §4 (lingkaran ikon + CTA kontekstual). |
| Sukses/Gagal aksi | **Toast** `fixed bottom-6 right-6 z-50 rounded-xl` — hijau `bg-emerald-600` / merah `bg-red-600`, `text-white text-xs font-semibold`, ikon `CheckCircle2`/`AlertCircle`, auto-hilang 4 detik. Pesan = kalimat lengkap Bahasa Indonesia ("Data koreksi berhasil disimpan."). |

Keyboard (konsisten di seluruh aplikasi):
- `F5` → segarkan data · `+` / Numpad+ → buka form baru (hanya saat tidak mengetik & tidak ada modal).
- Modal: `Escape` tutup · `Ctrl+S` simpan · `Ctrl+Shift+S` simpan & cetak.
- Setiap `useEffect` listener **bersihkan sendiri** (`removeEventListener` di cleanup) — pola sudah mapan, ikuti persis.

Motion dibatasi: `transition-colors` untuk hover/tema, `animate-spin` untuk proses, toast sliding ke atas, menu `fade-in/zoom-in` — cukup itu. Jangan menambah animasi baru.

> Catatan teknis: kelas `animate-in …` sudah tersebar (17 tempat) tetapi plugin `tailwindcss-animate` belum terpasang, jadi kelas itu belum menghasilkan apa-apa. Kalau nanti mengaktifkan, pasang `tailwindcss-animate` di `tailwind.config.js` — jangan menulis utilitas animasi kustom.

---

## 7. Dialog & Lembar Cetak

### Modal (form, viewer, konfirmasi)
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
     onMouseDown={e => e.target === e.currentTarget && onClose()}>
  <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
    {/* header: judul font-bold + tombol ✕, dipisah border-b */}
    {/* isi: space-y-3.5 */}
    {/* footer: border-t, justify-end — Batal (sekunder) / Simpan (primer) / aksi ekstra (emerald) */}
  </div>
</div>
```
Aturan: `Escape` + klik backdrop menutup (kecuali sedang `loading`); konfirmasi hapus **selalu** lewat `ConfirmDeleteDialog` (chip ikon merah `AlertTriangle` + kalimat dampak + tombol merah) — tidak ada hapus langsung.

### Lembar Cetak Dinas (`print/*.tsx` + `print.css`)
1. Render lewat `createPortal` ke `document.body` dengan wrapper `print-overlay-root` (backdrop seperti modal + toolbar pratinjau).
2. `print.css` menyembunyikan seluruh body kecuali `.print-overlay-root` — lembar lain otomatis bersih, printer Brother/Epson/Canon aman, tepat 1 halaman (`page-break-inside: avoid`).
3. Kertas **selalu putih** walau dark mode: `w-[210mm] bg-white text-black font-serif text-[11pt]` — kop resmi (logo + nama dinas + alamat), garis ganda dinas, nomor `font-mono`, 3 kotak tanda tangan berdampingan (`h-[5.2cm]`), footer "Dicetak: …".
4. Auto `window.print()` ±250 ms setelah buka + tombol "Cetak Sekarang".

---

## 8. Guardrail Anti-Slop (uji akhir sebelum rampung)

Semua ini adalah "Don't" resmi proyek — langgar berarti tampilan turun kelas:

- **Tidak** gradien ungu-biru neon, glow dekoratif, atau glassmorphism berlebihan. Kedalaman = border 1px + `shadow-sm`.
- **Tidak** teks fungsional di bawah 11px (`text-[11px]` adalah lantai).
- **Tidak** font web generik/AI — Segoe UI Variable sudah menang di lingkungan Windows.
- **Tidak** border aksen tebal 4px di satu sisi kartu, tidak kotak ikon besar menumpuk di atas judul kecil, tidak emoji sebagai ikon UI.
- **Tidak** memperkenalkan palet/font/radius baru — pakai token & skala yang ada (§1).
- **Tidak** satu layar lebih dari satu tombol primer; aksen indigo ≤10% area layar.
- **Tidak** menghapus/merusak tanpa dialog konfirmasi.
- Tanggal selalu format dinas; nomor dinas selalu mono; label selalu ≥11px.

**Checklist cepat:**
1. [ ] Setiap elemen punya pasangan `dark:` dan terbaca di `bg-slate-950`.
2. [ ] Satu tombol primer di layar; aksi destruktif merah & terkonfirmasi.
3. [ ] State lengkap: loading / error+retry / empty+CTA / toast.
4. [ ] Ikon lucide konsisten 14–16px, semua tombol aksi punya `title`.
5. [ ] Nomor dinas mono; tanggal `dd MMMM yyyy`.
6. [ ] Tidak ada animasi di luar pola yang ada; modal `Escape` + backdrop-close.
7. [ ] Baca ulang `DESIGN.md` (Named Rules + Don'ts) sebelum commit.
