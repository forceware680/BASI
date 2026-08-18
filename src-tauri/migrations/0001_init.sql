-- status enum (hanya 2 nilai, jangan ditambah tanpa instruksi)
-- idempotent: buat hanya jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_tanda_terima') THEN
        CREATE TYPE status_tanda_terima AS ENUM ('MENUNGGU_BUKTI', 'SELESAI');
    END IF;
END $$;

-- Master data OPD (REQ-01)
CREATE TABLE IF NOT EXISTS master_opd (
    id          SERIAL PRIMARY KEY,
    nama_opd    VARCHAR(150) NOT NULL UNIQUE,
    singkatan   VARCHAR(50),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data koreksi BMD (satu baris = satu berkas BA)
CREATE TABLE IF NOT EXISTS koreksi_bmd (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_tu               VARCHAR(100) NOT NULL,
    no_ba               VARCHAR(100) NOT NULL,
    opd_id              INT NOT NULL REFERENCES master_opd(id) ON DELETE RESTRICT,
    tanggal_surat       DATE NOT NULL DEFAULT CURRENT_DATE,
    penjelasan_koreksi  TEXT NOT NULL,
    status              status_tanda_terima NOT NULL DEFAULT 'MENUNGGU_BUKTI',
    file_path           TEXT,
    file_name           VARCHAR(255),
    file_type           VARCHAR(50),
    uploaded_at         TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_koreksi_status ON koreksi_bmd(status);
CREATE INDEX IF NOT EXISTS idx_koreksi_opd    ON koreksi_bmd(opd_id);

-- trigger auto-updated_at (idempotent)
-- urut: drop TRIGGER dulu (trigger bergantung ke function), baru drop function
DROP TRIGGER IF EXISTS trg_koreksi_updated_at ON koreksi_bmd;
DROP FUNCTION IF EXISTS set_updated_at();
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_koreksi_updated_at
BEFORE UPDATE ON koreksi_bmd
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
