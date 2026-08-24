// db.rs — koneksi PostgreSQL + auto-create database & migrasi idempoten saat startup / switch runtime.

use sqlx::postgres::PgConnectOptions;
use sqlx::{Connection, PgConnection};
use std::str::FromStr;
use tokio::sync::RwLock;

/// Default DATABASE_URL bila env/config tidak diset.
pub const DEFAULT_DATABASE_URL: &str =
    "postgresql://postgres:postgres@localhost:5432/sim_ba_koreksi";

/// Pool PostgreSQL.
pub type DbPool = sqlx::PgPool;

/// State pembungkus Connection Pool yang thread-safe dan bisa diganti dinamis (hot-switch).
pub struct DbState(pub RwLock<DbPool>);

impl DbState {
    pub async fn pool(&self) -> DbPool {
        self.0.read().await.clone()
    }

    pub async fn set_pool(&self, new_pool: DbPool) {
        let mut w = self.0.write().await;
        *w = new_pool;
    }
}

/// Memastikan database target sudah ada di server PostgreSQL; jika belum, buat otomatis.
async fn ensure_database_exists(db_url: &str) -> Result<(), String> {
    let opts = PgConnectOptions::from_str(db_url)
        .map_err(|e| format!("URL database tidak valid: {e}"))?;

    let target_db = opts.get_database().unwrap_or("sim_ba_koreksi").to_string();
    println!("[DB] Memeriksa ketersediaan database '{}' di port {}...", target_db, opts.get_port());

    // 1. Coba koneksi langsung ke target database
    if let Ok(conn) = PgConnection::connect_with(&opts).await {
        let _ = conn.close().await;
        println!("[DB] Database '{}' terhubung dengan baik.", target_db);
        return Ok(());
    }

    println!("[DB] Database '{}' belum ditemukan. Menyambung ke server PostgreSQL utama...", target_db);

    // 2. Jika gagal karena DB belum dibuat, sambungkan ke database maintenance 'postgres'
    let root_opts = opts.clone().database("postgres");
    let mut root_conn = match PgConnection::connect_with(&root_opts).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[DB ERROR] Gagal menyambung ke server PostgreSQL: {e}");
            return Err(format!(
                "Gagal menyambung ke server PostgreSQL. Pastikan host dan port {} dapat diakses. ({e})",
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
        println!("[DB] Membuat database baru: '{}'...", target_db);
        let query = format!("CREATE DATABASE \"{}\"", target_db.replace('"', "\"\""));
        sqlx::query(&query)
            .execute(&mut root_conn)
            .await
            .map_err(|e| {
                eprintln!("[DB ERROR] Gagal membuat database: {e}");
                format!("Gagal membuat database '{target_db}'. ({e})")
            })?;
        println!("[DB] Database '{}' berhasil dibuat otomatis.", target_db);
    }

    let _ = root_conn.close().await;
    Ok(())
}

/// Buat pool dari URL spesifik, jalankan migrasi idempoten.
pub async fn connect_with_url(url: &str) -> Result<DbPool, String> {
    // Pastikan database ada sebelum membuat pool
    ensure_database_exists(url).await?;

    println!("[DB] Menginisialisasi Connection Pool ke PostgreSQL...");
    let pool = sqlx::PgPool::connect(url)
        .await
        .map_err(|e| {
            eprintln!("[DB ERROR] Gagal inisialisasi pool: {e}");
            format!("Tidak dapat terhubung ke database. ({e})")
        })?;

    // sqlx::migrate! embeds the SQL at compile time and expands to a Migrator struct
    println!("[DB] Menjalankan migrasi skema SQLx idempoten...");
    if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
        eprintln!("[DB WARN] Peringatan migrasi SQLx: {e}");
        
        // Cek apakah tabel utama sudah ada di database
        let table_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'koreksi_bmd')"
        )
        .fetch_one(&pool)
        .await
        .unwrap_or(false);

        if table_exists {
            println!("[DB] Tabel utama 'koreksi_bmd' sudah terisi/eksis. Melewati validasi checksum migrasi lama.");
            // Pastikan index unik esensial tetap ada secara idempoten
            let _ = sqlx::query(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_koreksi_no_ba_unique ON koreksi_bmd (lower(trim(no_ba)))"
            )
            .execute(&pool)
            .await;
            let _ = sqlx::query(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_koreksi_no_tu_unique ON koreksi_bmd (lower(trim(no_tu)))"
            )
            .execute(&pool)
            .await;
        } else {
            eprintln!("[DB ERROR] Gagal inisialisasi tabel pada database baru: {e}");
            return Err(format!("Gagal menjalankan migrasi database awal. ({e})"));
        }
    } else {
        println!("[DB] Migrasi skema selesai. Semua tabel & seeder OPD siap.");
    }

    // Pastikan tabel users dan akun default admin selalu siap secara idempoten
    ensure_users_and_admin(&pool).await;

    Ok(pool)
}

/// Pastikan tabel users dan akun admin default terpasang secara aman
async fn ensure_users_and_admin(pool: &DbPool) {
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username      VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name     VARCHAR(100) NOT NULL,
            role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'USER')),
            is_active     BOOLEAN NOT NULL DEFAULT TRUE,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ
        );",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(trim(username)));",
    )
    .execute(pool)
    .await;

    // Cek apakah akun admin sudah ada
    let admin_exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN')")
        .fetch_one(pool)
        .await
        .unwrap_or(false);

    if !admin_exists {
        println!("[DB] Menginisialisasi akun Administrator default ('admin')...");
        let hash = bcrypt::hash("admin123", 10).unwrap_or_else(|_| {
            "$2b$10$vI8aWBnW3fID.ZQ4/zo1G.qHkK3mSGe7q8k6rA.7y54WbC1mY5hE6".to_string()
        });
        let _ = sqlx::query(
            "INSERT INTO users (username, password_hash, full_name, role, is_active)
             VALUES ('admin', $1, 'Administrator BPKAD', 'ADMIN', TRUE)
             ON CONFLICT (username) DO NOTHING;",
        )
        .bind(&hash)
        .execute(pool)
        .await;
        println!("[DB] Akun admin default berhasil disiapkan (username: admin, password: admin123).");
    }
}

/// Helper default connect dari DEFAULT_DATABASE_URL / env
pub async fn connect() -> Result<DbPool, String> {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    connect_with_url(&url).await
}

/// Helper untuk menguji konektivitas database tanpa menerapkan migrasi.
pub async fn test_connection(url: &str) -> Result<String, String> {
    let opts = PgConnectOptions::from_str(url)
        .map_err(|e| format!("Format URL PostgreSQL tidak valid: {e}"))?;

    let host = opts.get_host().to_string();
    let port = opts.get_port();
    let db_name = opts.get_database().unwrap_or("sim_ba_koreksi").to_string();

    let mut conn = PgConnection::connect_with(&opts)
        .await
        .map_err(|e| format!("Gagal menghubungi database ({host}:{port}/{db_name}): {e}"))?;

    let version: String = sqlx::query_scalar("SELECT version()")
        .fetch_one(&mut conn)
        .await
        .unwrap_or_else(|_| "PostgreSQL".to_string());

    let _ = conn.close().await;
    Ok(format!("Koneksi sukses ke {host}:{port}/{db_name}. ({})", version.split(',').next().unwrap_or("")))
}
