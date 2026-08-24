-- 0004_create_users_table.sql
-- Tabel pengguna dan peran (ADMIN & USER) untuk SIMBASI BMD

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'USER')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(trim(username)));

-- Seed default admin akun jika belum ada (username: admin, password: admin123)
-- Bcrypt hash $2b$10$vI8aWBnW3fID.ZQ4/zo1G.qHkK3mSGe7q8k6rA.7y54WbC1mY5hE6 dihasilkan untuk 'admin123'
INSERT INTO users (id, username, password_hash, full_name, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.qHkK3mSGe7q8k6rA.7y54WbC1mY5hE6',
    'Administrator BPKAD',
    'ADMIN',
    TRUE
)
ON CONFLICT (username) DO NOTHING;
