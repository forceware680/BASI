// commands/koreksi.rs — CRUD koreksi (REQ-02/05, BR).

use crate::models::{CreateKoreksiDto, KoreksiRow, StatusTandaTerima};
use sqlx::PgPool;

/// Baris koreksi + join nama OPD (13 kolom, urut created_at DESC).
type Row = (
    String,
    String,
    String,
    i32,
    Option<String>,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    String,
    Option<String>,
);

fn to_row(r: Row) -> KoreksiRow {
    KoreksiRow {
        id: r.0,
        no_tu: r.1,
        no_ba: r.2,
        opd_id: r.3,
        nama_opd: r.4.unwrap_or_default(),
        tanggal_surat: r.5,
        penjelasan_koreksi: r.6,
        status: StatusTandaTerima::from_db(&r.7),
        file_name: r.8,
        file_type: r.9,
        uploaded_at: r.10,
        created_at: r.11,
        file_path: r.12,
    }
}

// SQL tunggal-baris
const ROWS_SQL: &str = "SELECT k.id::text, k.no_tu, k.no_ba, k.opd_id, o.nama_opd, k.tanggal_surat::text, k.penjelasan_koreksi, k.status::text, k.file_name, k.file_type, k.uploaded_at::text, k.created_at::text, k.file_path FROM koreksi_bmd k LEFT JOIN master_opd o ON o.id = k.opd_id";

fn db_err(e: sqlx::Error) -> String {
    format!("Gagal mengakses data. ({})", e)
}

/// List koreksi (search global + filter status). Urut created_at DESC.
pub async fn list_koreksi(
    db: &PgPool,
    search: Option<String>,
    status: Option<String>,
) -> Result<Vec<KoreksiRow>, String> {
    let s = search.unwrap_or_default();
    let st = status.unwrap_or_default();
    let q = format!("{ROWS_SQL} WHERE ( $1 = '' OR lower(k.no_ba) LIKE lower($3) OR lower(k.no_tu) LIKE lower($3) OR lower(o.nama_opd) LIKE lower($3) ) AND ( $2 = '' OR k.status::text = $2 ) ORDER BY k.created_at DESC");
    let rows: Vec<Row> = sqlx::query_as(&q)
        .bind(&s)
        .bind(&st)
        .bind(format!("%{}%", s.trim()))
        .fetch_all(db)
        .await
        .map_err(db_err)?;
    Ok(rows.into_iter().map(to_row).collect())
}

/// Ambil satu baris (prefill edit / preview cetak).
pub async fn get_koreksi(db: &PgPool, id: &str) -> Result<KoreksiRow, String> {
    let r: Row = sqlx::query_as(&format!("{ROWS_SQL} WHERE k.id = $1::uuid"))
        .bind(id)
        .fetch_one(db)
        .await
        .map_err(|_| "Record tidak ditemukan.".to_string())?;
    Ok(to_row(r))
}

/// Buat record baru (status selalu MENUNGGU_BUKTI).
pub async fn create_koreksi(
    db: &PgPool,
    payload: CreateKoreksiDto,
) -> Result<KoreksiRow, String> {
    crate::models::validate(&payload)?;
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM master_opd WHERE id = $1")
        .bind(payload.opd_id)
        .fetch_one(db)
        .await
        .map_err(db_err)?;
    if n == 0 {
        return Err("OPD tidak ditemukan.".to_string());
    }
    let id: String = sqlx::query_scalar(
        "INSERT INTO koreksi_bmd (no_tu, no_ba, opd_id, tanggal_surat, penjelasan_koreksi) VALUES ($1, $2, $3, $4::date, $5) RETURNING id::text",
    )
    .bind(&payload.no_tu)
    .bind(&payload.no_ba)
    .bind(payload.opd_id)
    .bind(&payload.tanggal_surat)
    .bind(&payload.penjelasan_koreksi)
    .fetch_one(db)
    .await
    .map_err(db_err)?;
    get_koreksi(db, &id).await
}

/// Edit record. Tolak jika SELESAI (read-only).
pub async fn update_koreksi(
    db: &PgPool,
    id: String,
    payload: CreateKoreksiDto,
) -> Result<KoreksiRow, String> {
    let cur = get_koreksi(db, &id).await?;
    if cur.status == StatusTandaTerima::Selesai {
        return Err("Record sudah SELESAI dan bersifat read-only.".to_string());
    }
    crate::models::validate(&payload)?;
    sqlx::query(
        "UPDATE koreksi_bmd SET no_tu=$1, no_ba=$2, opd_id=$3, tanggal_surat=$4::date, penjelasan_koreksi=$5 WHERE id=$6::uuid",
    )
    .bind(&payload.no_tu)
    .bind(&payload.no_ba)
    .bind(payload.opd_id)
    .bind(&payload.tanggal_surat)
    .bind(&payload.penjelasan_koreksi)
    .bind(&id)
    .execute(db)
    .await
    .map_err(db_err)?;
    get_koreksi(db, &id).await
}

/// Hapus record koreksi dan file bukti fisik yang terkait jika ada.
pub async fn delete_koreksi(db: &PgPool, id: String) -> Result<(), String> {
    let row = get_koreksi(db, &id).await?;
    if let Some(fp) = row.file_path {
        crate::storage::remove_file(&fp);
    }
    sqlx::query("DELETE FROM koreksi_bmd WHERE id=$1::uuid")
        .bind(&id)
        .execute(db)
        .await
        .map_err(db_err)?;
    Ok(())
}

/// Cek duplikat no_ba (warning, bukan blokir).
pub async fn is_no_ba_used(
    db: &PgPool,
    no_ba: String,
    exclude: Option<String>,
) -> Result<bool, String> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM koreksi_bmd WHERE lower(no_ba)=lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)",
    )
    .bind(&no_ba)
    .bind(exclude)
    .fetch_one(db)
    .await
    .map_err(db_err)?;
    Ok(n > 0)
}
