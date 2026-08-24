-- 0005_add_created_by_to_koreksi.sql
-- Menambahkan relasi pembuat/penginput (created_by) pada tabel koreksi_bmd

ALTER TABLE koreksi_bmd ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
