// commands/koreksi.rs — CRUD koreksi (REQ-02/05, BR).

use crate::models::{CreateKoreksiDto, KoreksiRow, StatusTandaTerima};
use sqlx::PgPool;

/// Baris koreksi + join nama OPD + join users pembuat (16 kolom, urut created_at DESC).
type Row = (
    String,         // 0: id
    String,         // 1: no_tu
    String,         // 2: no_ba
    i32,            // 3: opd_id
    Option<String>, // 4: nama_opd
    String,         // 5: tanggal_surat
    String,         // 6: penjelasan_koreksi
    String,         // 7: status
    Option<String>, // 8: file_name
    Option<String>, // 9: file_type
    Option<String>, // 10: uploaded_at
    String,         // 11: created_at
    Option<String>, // 12: file_path
    Option<String>, // 13: created_by
    Option<String>, // 14: created_by_name
    Option<String>, // 15: created_by_role
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
        created_by: r.13,
        created_by_name: r.14,
        created_by_role: r.15,
    }
}

// SQL tunggal-baris dengan LEFT JOIN master_opd dan users
const ROWS_SQL: &str = "SELECT k.id::text, k.no_tu, k.no_ba, k.opd_id, o.nama_opd, k.tanggal_surat::text, k.penjelasan_koreksi, k.status::text, k.file_name, k.file_type, k.uploaded_at::text, k.created_at::text, k.file_path, k.created_by::text, u.full_name, u.role FROM koreksi_bmd k LEFT JOIN master_opd o ON o.id = k.opd_id LEFT JOIN users u ON u.id = k.created_by";

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
    let q = format!("{ROWS_SQL} WHERE ( $1 = '' OR lower(k.no_ba) LIKE lower($3) OR lower(k.no_tu) LIKE lower($3) OR lower(o.nama_opd) LIKE lower($3) OR lower(coalesce(u.full_name, '')) LIKE lower($3) ) AND ( $2 = '' OR k.status::text = $2 ) ORDER BY k.created_at DESC");
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

    // Cek duplikat No. Surat TU
    let tu_exists = is_no_tu_used(db, payload.no_tu.clone(), None).await?;
    if tu_exists {
        return Err(format!(
            "No. Surat TU '{}' sudah terdaftar dalam sistem. Nomor TU tidak boleh duplikat.",
            payload.no_tu.trim()
        ));
    }

    // Cek duplikat No. BA Koreksi
    let ba_exists = is_no_ba_used(db, payload.no_ba.clone(), None).await?;
    if ba_exists {
        return Err(format!(
            "No. BA Koreksi '{}' sudah terdaftar dalam sistem. Nomor BA tidak boleh duplikat.",
            payload.no_ba.trim()
        ));
    }

    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM master_opd WHERE id = $1")
        .bind(payload.opd_id)
        .fetch_one(db)
        .await
        .map_err(db_err)?;
    if n == 0 {
        return Err("OPD tidak ditemukan.".to_string());
    }

    let created_by_val = payload.created_by.as_deref().filter(|s| !s.trim().is_empty());

    let id: String = sqlx::query_scalar(
        "INSERT INTO koreksi_bmd (no_tu, no_ba, opd_id, tanggal_surat, penjelasan_koreksi, created_by) VALUES ($1, $2, $3, $4::date, $5, $6::uuid) RETURNING id::text",
    )
    .bind(payload.no_tu.trim())
    .bind(payload.no_ba.trim())
    .bind(payload.opd_id)
    .bind(&payload.tanggal_surat)
    .bind(&payload.penjelasan_koreksi)
    .bind(created_by_val)
    .fetch_one(db)
    .await
    .map_err(|e| {
        let msg = e.to_string().to_lowercase();
        if msg.contains("idx_koreksi_no_ba_unique") || msg.contains("unique") && msg.contains("no_ba") {
            format!("No. BA Koreksi '{}' sudah terdaftar dalam database.", payload.no_ba.trim())
        } else if msg.contains("idx_koreksi_no_tu_unique") || msg.contains("unique") && msg.contains("no_tu") {
            format!("No. Surat TU '{}' sudah terdaftar dalam database.", payload.no_tu.trim())
        } else {
            db_err(e)
        }
    })?;
    println!("[KOREKSI] Berhasil menambahkan BA Koreksi baru: '{}' (TU: '{}')", payload.no_ba.trim(), payload.no_tu.trim());
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

    // Cek duplikat No. Surat TU (kecuali id ini)
    let tu_exists = is_no_tu_used(db, payload.no_tu.clone(), Some(id.clone())).await?;
    if tu_exists {
        return Err(format!(
            "No. Surat TU '{}' sudah terdaftar pada berkas lain. Nomor TU tidak boleh duplikat.",
            payload.no_tu.trim()
        ));
    }

    // Cek duplikat No. BA Koreksi (kecuali id ini)
    let ba_exists = is_no_ba_used(db, payload.no_ba.clone(), Some(id.clone())).await?;
    if ba_exists {
        return Err(format!(
            "No. BA Koreksi '{}' sudah terdaftar pada berkas lain. Nomor BA tidak boleh duplikat.",
            payload.no_ba.trim()
        ));
    }

    sqlx::query(
        "UPDATE koreksi_bmd SET no_tu=$1, no_ba=$2, opd_id=$3, tanggal_surat=$4::date, penjelasan_koreksi=$5 WHERE id=$6::uuid",
    )
    .bind(payload.no_tu.trim())
    .bind(payload.no_ba.trim())
    .bind(payload.opd_id)
    .bind(&payload.tanggal_surat)
    .bind(&payload.penjelasan_koreksi)
    .bind(&id)
    .execute(db)
    .await
    .map_err(|e| {
        let msg = e.to_string().to_lowercase();
        if msg.contains("idx_koreksi_no_ba_unique") || msg.contains("unique") && msg.contains("no_ba") {
            format!("No. BA Koreksi '{}' sudah terdaftar dalam database.", payload.no_ba.trim())
        } else if msg.contains("idx_koreksi_no_tu_unique") || msg.contains("unique") && msg.contains("no_tu") {
            format!("No. Surat TU '{}' sudah terdaftar dalam database.", payload.no_tu.trim())
        } else {
            db_err(e)
        }
    })?;
    println!("[KOREKSI] Berhasil memperbarui data BA Koreksi: '{}'", payload.no_ba.trim());
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
    println!("[KOREKSI] Berhasil menghapus permanen data BA Koreksi: '{}'", row.no_ba);
    Ok(())
}

/// Cek duplikat no_ba (case-insensitive & trimmed).
pub async fn is_no_ba_used(
    db: &PgPool,
    no_ba: String,
    exclude: Option<String>,
) -> Result<bool, String> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM koreksi_bmd WHERE lower(trim(no_ba))=lower(trim($1)) AND ($2::uuid IS NULL OR id <> $2::uuid)",
    )
    .bind(&no_ba)
    .bind(exclude)
    .fetch_one(db)
    .await
    .map_err(db_err)?;
    Ok(n > 0)
}

/// Cek duplikat no_tu (case-insensitive & trimmed).
pub async fn is_no_tu_used(
    db: &PgPool,
    no_tu: String,
    exclude: Option<String>,
) -> Result<bool, String> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM koreksi_bmd WHERE lower(trim(no_tu))=lower(trim($1)) AND ($2::uuid IS NULL OR id <> $2::uuid)",
    )
    .bind(&no_tu)
    .bind(exclude)
    .fetch_one(db)
    .await
    .map_err(db_err)?;
    Ok(n > 0)
}
