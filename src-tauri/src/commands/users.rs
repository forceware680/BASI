// commands/users.rs — Manajemen Pengguna & Hak Akses (Khusus Admin).

use crate::models::{CreateUserDto, UpdateUserDto, UserItem};
use sqlx::PgPool;

fn db_err(e: sqlx::Error) -> String {
    format!("Gagal mengakses data pengguna. ({})", e)
}

#[derive(sqlx::FromRow)]
struct DbUserRow {
    id: String,
    username: String,
    full_name: String,
    role: String,
    is_active: bool,
    created_at: String,
    last_login_at: Option<String>,
}

/// Daftar seluruh akun pengguna dalam sistem (Urut berdasarkan waktu pembuatan).
pub async fn list_users(db: &PgPool) -> Result<Vec<UserItem>, String> {
    let rows: Vec<DbUserRow> = sqlx::query_as(
        "SELECT id::text, username, full_name, role, is_active, created_at::text, last_login_at::text
         FROM users
         ORDER BY created_at ASC",
    )
    .fetch_all(db)
    .await
    .map_err(db_err)?;

    Ok(rows
        .into_iter()
        .map(|r| UserItem {
            id: r.id,
            username: r.username,
            full_name: r.full_name,
            role: r.role,
            is_active: r.is_active,
            created_at: r.created_at,
            last_login_at: r.last_login_at,
        })
        .collect())
}

/// Buat akun pengguna baru (Role ADMIN atau USER).
pub async fn create_user(db: &PgPool, payload: CreateUserDto) -> Result<UserItem, String> {
    let username = payload.username.trim().to_lowercase();
    let full_name = payload.full_name.trim().to_string();
    let role_raw = payload.role.trim().to_uppercase();
    let role = if role_raw == "USER" || role_raw == "OPERATOR" {
        "OPERATOR".to_string()
    } else {
        role_raw
    };

    if username.is_empty() {
        return Err("Nama pengguna (username) wajib diisi.".to_string());
    }
    if full_name.is_empty() {
        return Err("Nama lengkap wajib diisi.".to_string());
    }
    if payload.password.trim().len() < 5 {
        return Err("Kata sandi minimal harus 5 karakter.".to_string());
    }
    if role != "ADMIN" && role != "OPERATOR" {
        return Err("Peran pengguna harus 'ADMIN' atau 'OPERATOR'.".to_string());
    }

    // Cek duplikasi username
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM users WHERE lower(trim(username)) = $1)",
    )
    .bind(&username)
    .fetch_one(db)
    .await
    .map_err(db_err)?;

    if exists {
        return Err(format!("Username '{}' sudah digunakan. Pilih username lain.", username));
    }

    // Hash kata sandi dengan bcrypt
    let password_hash = bcrypt::hash(&payload.password, 10)
        .map_err(|e| format!("Gagal memproses kata sandi: {e}"))?;

    let row: DbUserRow = sqlx::query_as(
        "INSERT INTO users (username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id::text, username, full_name, role, is_active, created_at::text, last_login_at::text",
    )
    .bind(&username)
    .bind(&password_hash)
    .bind(&full_name)
    .bind(&role)
    .fetch_one(db)
    .await
    .map_err(db_err)?;

    println!("[USER] Berhasil membuat akun baru: '{}' ({})", row.username, row.role);

    Ok(UserItem {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        role: row.role,
        is_active: row.is_active,
        created_at: row.created_at,
        last_login_at: row.last_login_at,
    })
}

/// Perbarui nama lengkap, role, dan status aktif akun pengguna.
pub async fn update_user(db: &PgPool, payload: UpdateUserDto) -> Result<UserItem, String> {
    let full_name = payload.full_name.trim().to_string();
    let role_raw = payload.role.trim().to_uppercase();
    let role = if role_raw == "USER" || role_raw == "OPERATOR" {
        "OPERATOR".to_string()
    } else {
        role_raw
    };

    if full_name.is_empty() {
        return Err("Nama lengkap wajib diisi.".to_string());
    }
    if role != "ADMIN" && role != "OPERATOR" {
        return Err("Peran pengguna harus 'ADMIN' atau 'OPERATOR'.".to_string());
    }

    // Mencegah penonaktifan atau penurunan hak akses seluruh admin (harus menyisakan minimal 1 Admin aktif)
    if !payload.is_active || role != "ADMIN" {
        let active_admin_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = TRUE AND id <> $1::uuid",
        )
        .bind(&payload.id)
        .fetch_one(db)
        .await
        .map_err(db_err)?;

        if active_admin_count == 0 {
            return Err("Operasi ditolak: Sistem harus memiliki minimal satu akun Administrator yang aktif.".to_string());
        }
    }

    let row: DbUserRow = sqlx::query_as(
        "UPDATE users
         SET full_name = $1, role = $2, is_active = $3
         WHERE id = $4::uuid
         RETURNING id::text, username, full_name, role, is_active, created_at::text, last_login_at::text",
    )
    .bind(&full_name)
    .bind(&role)
    .bind(payload.is_active)
    .bind(&payload.id)
    .fetch_one(db)
    .await
    .map_err(db_err)?;

    println!("[USER] Berhasil memperbarui data akun: '{}'", row.username);

    Ok(UserItem {
        id: row.id,
        username: row.username,
        full_name: row.full_name,
        role: row.role,
        is_active: row.is_active,
        created_at: row.created_at,
        last_login_at: row.last_login_at,
    })
}

/// Reset kata sandi pengguna oleh Administrator.
pub async fn reset_user_password(
    db: &PgPool,
    id: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.trim().len() < 5 {
        return Err("Kata sandi baru minimal harus 5 karakter.".to_string());
    }

    let password_hash = bcrypt::hash(&new_password, 10)
        .map_err(|e| format!("Gagal memproses kata sandi: {e}"))?;

    let rows_affected = sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2::uuid")
        .bind(&password_hash)
        .bind(&id)
        .execute(db)
        .await
        .map_err(db_err)?
        .rows_affected();

    if rows_affected == 0 {
        return Err("Pengguna tidak ditemukan.".to_string());
    }

    println!("[USER] Administrator mereset kata sandi pengguna ID '{}'.", id);
    Ok(())
}

/// Hapus akun pengguna.
pub async fn delete_user(db: &PgPool, id: String) -> Result<(), String> {
    // Pastikan tidak menghapus admin aktif terakhir
    let is_admin: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1::uuid AND role = 'ADMIN')",
    )
    .bind(&id)
    .fetch_one(db)
    .await
    .map_err(db_err)?;

    if is_admin {
        let remaining_admins: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = TRUE AND id <> $1::uuid",
        )
        .bind(&id)
        .fetch_one(db)
        .await
        .map_err(db_err)?;

        if remaining_admins == 0 {
            return Err("Tidak dapat menghapus akun ini: Sistem harus menyisakan minimal satu Administrator aktif.".to_string());
        }
    }

    let rows_affected = sqlx::query("DELETE FROM users WHERE id = $1::uuid")
        .bind(&id)
        .execute(db)
        .await
        .map_err(db_err)?
        .rows_affected();

    if rows_affected == 0 {
        return Err("Pengguna tidak ditemukan.".to_string());
    }

    println!("[USER] Berhasil menghapus akun pengguna ID '{}'.", id);
    Ok(())
}
