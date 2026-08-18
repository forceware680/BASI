// commands/opd.rs — master data OPD (REQ-01).

use crate::models::Opd;
use sqlx::PgPool;

fn db_err(e: sqlx::Error) -> String {
    format!("Gagal mengakses data. ({})", e)
}

/// Daftar OPD aktif, urut `nama_opd`, filter ILIKE nama/singkatan (live search).
/// SQL tunggal-baris: JANGAN pakai line-continuation `\` (lihat catatan di koreksi.rs).
pub async fn list_opd(db: &PgPool, search: Option<String>) -> Result<Vec<Opd>, String> {
    let rows: Vec<(i32, String, Option<String>)> = match search {
        Some(s) if !s.trim().is_empty() => {
            sqlx::query_as(
                "SELECT id, nama_opd, singkatan FROM master_opd WHERE is_active = TRUE AND (lower(nama_opd) LIKE lower($1) OR singkatan LIKE lower($1)) ORDER BY nama_opd",
            )
            .bind(format!("%{}%", s.trim()))
            .fetch_all(db)
            .await
            .map_err(db_err)?
        }
        _ => {
            sqlx::query_as(
                "SELECT id, nama_opd, singkatan FROM master_opd WHERE is_active = TRUE ORDER BY nama_opd",
            )
            .fetch_all(db)
            .await
            .map_err(db_err)?
        }
    };
    Ok(rows
        .into_iter()
        .map(|r| Opd {
            id: r.0,
            nama_opd: r.1,
            singkatan: r.2,
            is_active: true,
        })
        .collect())
}

/// Tambah OPD baru (inline dari combobox). Tolak duplikat nama.
pub async fn create_opd(
    db: &PgPool,
    nama_opd: String,
    singkatan: Option<String>,
) -> Result<Opd, String> {
    let nama = nama_opd.trim().to_string();
    if nama.is_empty() {
        return Err("Nama OPD wajib diisi.".to_string());
    }
    let dup: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM master_opd WHERE lower(nama_opd)=lower($1)",
    )
    .bind(&nama)
    .fetch_one(db)
    .await
    .map_err(db_err)?;
    if dup > 0 {
        return Err("OPD dengan nama itu sudah ada.".to_string());
    }
    let id: i32 = sqlx::query_scalar(
        "INSERT INTO master_opd (nama_opd, singkatan, is_active) VALUES ($1,$2,TRUE) RETURNING id",
    )
    .bind(&nama)
    .bind(&singkatan)
    .fetch_one(db)
    .await
    .map_err(db_err)?;
    Ok(Opd {
        id,
        nama_opd: nama,
        singkatan,
        is_active: true,
    })
}
