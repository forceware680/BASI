-- 0002_unique_no_ba_no_tu.sql
-- Enforce case-insensitive unique constraints on no_ba and no_tu

-- 1. Bersihkan duplikat data uji lama jika ada (menyimpan record terbaru)
DELETE FROM koreksi_bmd a USING koreksi_bmd b
WHERE a.created_at < b.created_at
  AND lower(trim(a.no_ba)) = lower(trim(b.no_ba))
  AND a.id <> b.id;

DELETE FROM koreksi_bmd a USING koreksi_bmd b
WHERE a.created_at < b.created_at
  AND lower(trim(a.no_tu)) = lower(trim(b.no_tu))
  AND a.id <> b.id;

-- 2. Buat index unik permanen
CREATE UNIQUE INDEX IF NOT EXISTS idx_koreksi_no_ba_unique ON koreksi_bmd (lower(trim(no_ba)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_koreksi_no_tu_unique ON koreksi_bmd (lower(trim(no_tu)));

