// models.rs — struct data + DTO (mirror lib/types.ts) + validasi payload.
//
// Semua query SQL ada di modul `commands`.

use serde::{Deserialize, Serialize};

/// Master data OPD (REQ-01).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Opd {
    pub id: i32,
    pub nama_opd: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub singkatan: Option<String>,
    pub is_active: bool,
}

/// Enum status (hanya 2 nilai). JSON: "MENUNGGU_BUKTI" | "SELESAI".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StatusTandaTerima {
    MenungguBukti,
    Selesai,
}

impl StatusTandaTerima {
    /// Dari string DB (enum PG: "MENUNGGU_BUKTI" | "SELESAI").
    pub fn from_db(s: &str) -> Self {
        match s {
            "MENUNGGU_BUKTI" => Self::MenungguBukti,
            _ => Self::Selesai,
        }
    }
    /// Ke string DB.
    pub fn to_db(&self) -> &'static str {
        match self {
            Self::MenungguBukti => "MENUNGGU_BUKTI",
            Self::Selesai => "SELESAI",
        }
    }
}

/// Payload create/edit (mirror CreateKoreksiDto).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateKoreksiDto {
    pub no_tu: String,
    pub no_ba: String,
    pub opd_id: i32,
    /// 'YYYY-MM-DD'
    pub tanggal_surat: String,
    pub penjelasan_koreksi: String,
}

/// Baris koreksi BMD (join nama_opd).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KoreksiRow {
    pub id: String,
    pub no_tu: String,
    pub no_ba: String,
    pub opd_id: i32,
    pub nama_opd: String,
    /// 'YYYY-MM-DD'
    pub tanggal_surat: String,
    pub penjelasan_koreksi: String,
    pub status: StatusTandaTerima,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uploaded_at: Option<String>,
    pub created_at: String,
    /// path storage file bukti (internal, untuk viewer & hapus-lama).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// Validasi payload (server-side). Mengembalikan pesan error (Bahasa Indonesia)
/// atau Ok(()) jika valid.
pub fn validate(payload: &CreateKoreksiDto) -> Result<(), String> {
    if payload.no_tu.trim().is_empty() {
        return Err("No. Surat TU wajib diisi.".to_string());
    }
    if payload.no_ba.trim().is_empty() {
        return Err("No. BA Koreksi wajib diisi.".to_string());
    }
    if payload.opd_id <= 0 {
        return Err("OPD Pengusul wajib diisi.".to_string());
    }
    if payload.tanggal_surat.trim().is_empty() {
        return Err("Tanggal Surat wajib diisi.".to_string());
    }
    if payload.penjelasan_koreksi.trim().is_empty() {
        return Err("Uraian Koreksi wajib diisi.".to_string());
    }
    // Tanggal masa depan (ASUMSI). ISO string terurut leksikal.
    if let Ok(d) = chrono::NaiveDate::parse_from_str(&payload.tanggal_surat, "%Y-%m-%d") {
        let today = chrono::Utc::now().date_naive();
        if d > today {
            return Err("Tanggal surat tidak boleh melebihi hari ini.".to_string());
        }
    }
    Ok(())
}
