// db.rs — koneksi PostgreSQL + migrasi idempoten saat startup.
//
// Koneksi dari `DATABASE_URL` (fallback local). Migrasi `0001_init.sql`
// dijalankan idempoten tiap boot → aplikasi "auto-connect" (NFR-02, T-10).

/// Default DATABASE_URL bila env tidak diset.
const DEFAULT_DATABASE_URL: &str =
    "postgresql://postgres:postgres@localhost:5432/sim_ba_koreksi";

/// Pool PostgreSQL (Tauri state).
pub type DbPool = sqlx::PgPool;

/// Buat pool dari `DATABASE_URL`, jalankan migrasi idempoten.
pub async fn connect() -> Result<DbPool, String> {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    let pool = sqlx::PgPool::connect(&url)
        .await
        .map_err(|e| format!("Tidak dapat terhubung ke database. ({e})"))?;
    // sqlx::migrate! embeds the SQL at compile time and expands to a Migrator struct
    // literal. .run(&pool) applies it (PgConnection implements Migrate). Idempotent.
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("Gagal menjalankan migrasi database. ({e})"))?;
    Ok(pool)
}
