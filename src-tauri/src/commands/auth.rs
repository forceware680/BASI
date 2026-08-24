// commands/auth.rs — Autentikasi Pengguna & Manajemen Sesi SIMBASI BMD.

use crate::models::UserSession;
use sqlx::PgPool;

fn db_err(e: sqlx::Error) -> String {
    format!("Gagal mengakses data pengguna. ({})", e)
}

#[derive(sqlx::FromRow)]
struct AuthRow {
    id: String,
    username: String,
    password_hash: String,
    full_name: String,
    role: String,
    is_active: bool,
}

/// Login pengguna: verifikasi username & password hash bcrypt.
pub async fn login(
    db: &PgPool,
    username: String,
    password: String,
) -> Result<UserSession, String> {
    let clean_username = username.trim().to_lowercase();
    if clean_username.is_empty() || password.is_empty() {
        return Err("Username dan kata sandi wajib diisi.".to_string());
    }

    let row: Option<AuthRow> = sqlx::query_as(
        "SELECT id::text, username, password_hash, full_name, role, is_active
         FROM users
         WHERE lower(trim(username)) = $1",
    )
    .bind(&clean_username)
    .fetch_optional(db)
    .await
    .map_err(db_err)?;

    let user = match row {
        Some(u) => u,
        None => return Err("Nama pengguna atau kata sandi tidak cocok.".to_string()),
    };

    if !user.is_active {
        return Err("Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.".to_string());
    }

    // Verifikasi password bcrypt
    let is_valid = bcrypt::verify(&password, &user.password_hash)
        .map_err(|e| format!("Kesalahan validasi kata sandi: {e}"))?;

    if !is_valid {
        return Err("Nama pengguna atau kata sandi tidak cocok.".to_string());
    }

    // Perbarui last_login_at
    let _ = sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1::uuid")
        .bind(&user.id)
        .execute(db)
        .await;

    println!("[AUTH] Pengguna '{}' ({}) berhasil login.", user.username, user.role);

    Ok(UserSession {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
    })
}

/// Ganti kata sandi mandiri oleh pengguna.
pub async fn change_password(
    db: &PgPool,
    user_id: String,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.trim().len() < 5 {
        return Err("Kata sandi baru minimal harus 5 karakter.".to_string());
    }

    let current_hash: Option<String> = sqlx::query_scalar(
        "SELECT password_hash FROM users WHERE id = $1::uuid",
    )
    .bind(&user_id)
    .fetch_optional(db)
    .await
    .map_err(db_err)?;

    let hash = match current_hash {
        Some(h) => h,
        None => return Err("Pengguna tidak ditemukan.".to_string()),
    };

    let is_valid = bcrypt::verify(&old_password, &hash)
        .map_err(|e| format!("Kesalahan validasi kata sandi: {e}"))?;

    if !is_valid {
        return Err("Kata sandi saat ini (lama) tidak sesuai.".to_string());
    }

    let new_hash = bcrypt::hash(&new_password, 10)
        .map_err(|e| format!("Gagal memproses kata sandi baru: {e}"))?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2::uuid")
        .bind(&new_hash)
        .bind(&user_id)
        .execute(db)
        .await
        .map_err(db_err)?;

    println!("[AUTH] Pengguna ID '{}' berhasil mengubah kata sandi.", user_id);
    Ok(())
}

/// Ambil data sesi pengguna berdasarkan ID (verifikasi sesi aktif).
pub async fn get_session_user(
    db: &PgPool,
    user_id: String,
) -> Result<Option<UserSession>, String> {
    let row: Option<(String, String, String, String, bool)> = sqlx::query_as(
        "SELECT id::text, username, full_name, role, is_active FROM users WHERE id = $1::uuid",
    )
    .bind(&user_id)
    .fetch_optional(db)
    .await
    .map_err(db_err)?;

    match row {
        Some((id, username, full_name, role, is_active)) if is_active => Ok(Some(UserSession {
            id,
            username,
            full_name,
            role,
        })),
        _ => Ok(None),
    }
}
