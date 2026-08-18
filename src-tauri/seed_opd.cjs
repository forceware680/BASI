// seed_opd.cjs — seed 28 nama OPD ke master_opd (idempoten, ON CONFLICT DO NOTHING).
// Kredensial DB dibaca dari src/db.rs (DEFAULT_DATABASE_URL), bukan hardcode.
// Jalankan: node seed_opd.cjs
const fs = require("fs");
const cp = require("child_process");
const os = require("os");
const path = require("path");

const NAMES = [
  "Dinas Pendidikan dan Kebudayaan",
  "Dinas Kesehatan",
  "Dinas Pekerjaan Umum dan Penataan Ruang",
  "Dinas Perumahan dan Kawasan Permukiman",
  "Satuan Polisi Pamong Praja",
  "Badan Penanggulangan Bencana Daerah",
  "Dinas Sosial",
  "Dinas Tenaga Kerja",
  "Dinas Lingkungan Hidup",
  "Dinas Kependudukan dan Pencatatan Sipil",
  "Dinas Pemberdayaan Masyarakat, Perempuan, Perlindungan Anak, Pengendalian Penduduk dan Keluarga Berencana",
  "Dinas Perhubungan",
  "Dinas Komunikasi, Informatika, dan Statistik",
  "Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu",
  "Dinas Kepemudaan, Olahraga, dan Pariwisata",
  "Dinas Perpustakaan dan Kearsipan",
  "Dinas Pertanian dan Pangan",
  "Dinas Perdagangan Perindustrian Koperasi dan Usaha Mikro",
  "Sekretariat Daerah",
  "Sekretariat Dewan Perwakilan Rakyat Daerah",
  "Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah",
  "Badan Pengelola Keuangan dan Aset Daerah",
  "Badan Kepegawaian dan Pengembangan Sumber Daya Manusia",
  "Inspektorat Daerah",
  "Kecamatan Magelang Selatan",
  "Kecamatan Magelang Tengah",
  "Kecamatan Magelang Utara",
  "Badan Kesatuan Bangsa dan Politik",
];

// --- ambil URL dari db.rs ---
const src = fs.readFileSync("src/db.rs", "utf8");
const url = src.match(/postgresql:\/\/[^"\n]*/)[0];
if (!url) { console.error("GAGAL: DEFAULT_DATABASE_URL tidak ketemu"); process.exit(1); }
const parsed = new URL(url);
const env = {
  PGHOST: parsed.hostname,
  PGPORT: parsed.port,
  PGUSER: parsed.username,
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: parsed.pathname.slice(1),
};

// --- tulis SQL idempoten ke file temp ---
const esc = (s) => s.replace(/'/g, "''");
const sql =
  NAMES.map(
    (n) =>
      `INSERT INTO master_opd (nama_opd, singkatan, is_active) VALUES ('${esc(n)}', NULL, TRUE) ON CONFLICT (nama_opd) DO NOTHING;`
  ).join("\n") +
  "\nSELECT count(*) AS total FROM master_opd;\n";

const tmp = path.join(os.tmpdir(), "seed_opd_tmp.sql");
fs.writeFileSync(tmp, sql);

// --- jalankan psql (env creds, ON_ERROR_STOP, piped stdio, timeout) ---
const r = cp.spawnSync("psql", ["-tA", "--set", "ON_ERROR_STOP=on", "-f", tmp], {
  env,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 30000,
});

if (r.status !== 0) {
  console.error("PSQL FAIL:", (r.stderr || "").slice(0, 400), (r.stdout || "").slice(0, 400));
  process.exit(1);
}
console.log("total master_opd:", r.stdout.trim());
fs.unlinkSync(tmp);
console.log("seed OK:", NAMES.length, "nama → idempoten insert");
