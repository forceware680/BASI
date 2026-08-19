// db.rs — koneksi PostgreSQL + auto-create database & migrasi idempoten saat startup.
//
// Koneksi dari `DATABASE_URL` (fallback local). Jika database belum ada, dibuat otomatis
// di PostgreSQL lokal, kemudian migrasi `0001_init.sql` dijalankan idempoten tiap boot.

use sqlx::postgres::PgConnectOptions;
use sqlx::{Connection, PgConnection};
use std::str::FromStr;

/// Default DATABASE_URL bila env tidak diset.
const DEFAULT_DATABASE_URL: &str =
    "postgresql://postgres:postgres@localhost:5432/sim_ba_koreksi";

/// Pool PostgreSQL (Tauri state).
pub type DbPool = sqlx::PgPool;

/// Memastikan database `sim_ba_koreksi` sudah ada di server PostgreSQL; jika belum, buat otomatis.
async fn ensure_database_exists(db_url: &str) -> Result<(), String> {
    let opts = PgConnectOptions::from_str(db_url)
        .map_err(|e| format!("URL database tidak valid: {e}"))?;
    
    let target_db = opts.get_database().unwrap_or("sim_ba_koreksi").to_string();

    // 1. Coba koneksi langsung ke target database
    if let Ok(conn) = PgConnection::connect_with(&opts).await {
        let _ = conn.close().await;
        return Ok(());
    }

    // 2. Jika gagal karena DB belum dibuat, sambungkan ke database maintenance 'postgres'
    let root_opts = opts.clone().database("postgres");
    let mut root_conn = match PgConnection::connect_with(&root_opts).await {
        Ok(c) => c,
        Err(e) => {
            return Err(format!(
                "Gagal menyambung ke server PostgreSQL lokal. Pastikan layanan PostgreSQL sedang berjalan di port {}. ({e})",
                opts.get_port()
            ));
        }
    };

    // 3. Cek apakah database sudah ada
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)",
    )
    .bind(&target_db)
    .fetch_one(&mut root_conn)
    .await
    .unwrap_or(false);

    // 4. Jika belum ada, buat database baru
    if !exists {
        let query = format!("CREATE DATABASE \"{}\"", target_db.replace('"', "\"\""));
        sqlx::query(&query)
            .execute(&mut root_conn)
            .await
            .map_err(|e| format!("Gagal membuat database '{target_db}'. ({e})"))?;
    }

    let _ = root_conn.close().await;
    Ok(())
}

/// Buat pool dari `DATABASE_URL`, jalankan migrasi idempoten.
pub async fn connect() -> Result<DbPool, String> {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    
    // Pastikan database ada sebelum membuat pool
    ensure_database_exists(&url).await?;

    let pool = sqlx::PgPool::connect(&url)
        .await
        .map_err(|e| format!("Tidak dapat terhubung ke database. ({e})"))?;

    // sqlx::migrate! embeds the SQL at compile time and expands to a Migrator struct
    // literal. .run(&pool) applies it. Idempotent.
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("Gagal menjalankan migrasi database. ({e})"))?;

    Ok(pool)
}
