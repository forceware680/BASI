# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Operator dan Staf Subbidang Penatausahaan Aset, Badan Pengelolaan Keuangan dan Aset Daerah (BPKAD) Kota Magelang.

## Product Purpose
Sistem Informasi Manajemen Pelacakan & Sirkulasi Berita Acara (BA) Koreksi Barang Milik Daerah (BMD). Bertujuan menertibkan administrasi, melacak peredaran fisik lembar Berita Acara, menghasilkan lembar ekspedisi resmi (3 kolom tanda tangan), serta mengarsipkan bukti scan fisik secara digital dan terpusat.

## Positioning
Aplikasi desktop tata kelola aset daerah yang zero-config (didukung PostgreSQL portabel otomatis), beroperasi offline-first tanpa ketergantungan server eksternal, dan mengadopsi standar tata naskah dinas Pemerintah Kota Magelang.

## Operating Context
Penggunaan harian di lingkungan kerja BPKAD Kota Magelang; pencatatan surat masuk dari OPD pemohon, penerbitan tanda terima ekspedisi fisik untuk sirkulasi tanda tangan (OPD Pemohon, Bidang Akuntansi, Bidang Aset), dan digitalisasi berkas scan final.

## Capabilities and Constraints
- Master data 45 OPD Kota Magelang dengan penambahan dinamis.
- Pembuatan, penyuntingan, dan penghapusan data BA Koreksi dengan validasi nomor unik (No. BA Koreksi dan No. Surat TU tidak boleh duplikat).
- Cetak lembar ekspedisi tanda terima tunggal resmi (kop Pemkot Magelang, 3 kolom TTD & cap).
- Pelacakan status dua tahap: `MENUNGGU_BUKTI` dan `SELESAI` (setelah upload 1x bukti scan lengkap via File Explorer atau Direct Scanner WIA).
- Pratinjau berkas bukti digital (PDF, JPG, PNG) dengan kendali zoom dan pembuka aplikasi OS native.
- Ekspor rekapitulasi laporan berfilter ke CSV / Cetak Rekapitulasi resmi.
- Fitur pencadangan dan pemulihan penuh (database SQL + file bukti dalam format `.zip`).
- Dukungan Dark Mode dan Light Mode yang adaptif.
- Desktop Tauri v2 (Windows x64) dengan stack React 19, TypeScript, Tailwind CSS, PostgreSQL.

## Brand Commitments
- Nama: SIMBASI BMD
- Instansi: Pemerintah Kota Magelang — Badan Pengelolaan Keuangan dan Aset Daerah (BPKAD)
- Aset Identitas: Logo Resmi Kota Magelang (`logo-kota-magelang.png`)
- Tata Naskah Dinas: Format nomor dinas standar `000.2.3.2/[nomor]/440`

## Evidence on Hand
- Master data 45 OPD Kota Magelang pada migrasi database.
- File logo resmi Kota Magelang (`src/assets/logo-kota-magelang.png`).
- Format kop dinas dan struktur tanda terima 3 pihak resmi.

## Product Principles
1. **Ketertiban & Akurasi Administrasi**: Setiap perubahan status berkas terhubung dengan bukti otentik.
2. **Kesederhanaan Alur Kerja**: Cukup 1x cetak ekspedisi dan 1x unggah bukti untuk menutup sirkulasi berkas.
3. **Kemandirian Sistem (Offline-First)**: Tidak memerlukan konfigurasi server manual; portabel dan tahan gangguan jaringan.
4. **Kejelasan Tipografi & Hirarki Visual**: Tampilan tabel dan data padat terbaca jelas, kontras tinggi, dan bebas dari ornamen generik kecerdasan buatan.
