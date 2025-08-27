-- 既存のusers_masterテーブルのカラムを修正
-- 古いカラムを削除
ALTER TABLE users_master DROP COLUMN IF EXISTS temperature_base;
ALTER TABLE users_master DROP COLUMN IF EXISTS temperature_range;
ALTER TABLE users_master DROP COLUMN IF EXISTS systolic_bp_base;
ALTER TABLE users_master DROP COLUMN IF EXISTS systolic_bp_range;
ALTER TABLE users_master DROP COLUMN IF EXISTS diastolic_bp_base;
ALTER TABLE users_master DROP COLUMN IF EXISTS diastolic_bp_range;
ALTER TABLE users_master DROP COLUMN IF EXISTS pulse_base;
ALTER TABLE users_master DROP COLUMN IF EXISTS pulse_range;

-- 新しいカラムを追加
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS temperature_min DECIMAL(3,1) DEFAULT 36.0;
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS temperature_max DECIMAL(3,1) DEFAULT 37.5;
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS blood_pressure_systolic_min INTEGER DEFAULT 100;
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS blood_pressure_systolic_max INTEGER DEFAULT 140;
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS blood_pressure_diastolic_min INTEGER DEFAULT 60;
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS blood_pressure_diastolic_max INTEGER DEFAULT 90;
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS pulse_min INTEGER DEFAULT 60;
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS pulse_max INTEGER DEFAULT 100;