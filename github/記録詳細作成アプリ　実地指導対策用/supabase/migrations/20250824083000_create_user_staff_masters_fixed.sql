-- 利用者マスタテーブル
CREATE TABLE users_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  -- 健康チェック基準値
  temperature_min DECIMAL(3,1) DEFAULT 36.0,
  temperature_max DECIMAL(3,1) DEFAULT 37.5,
  blood_pressure_systolic_min INTEGER DEFAULT 100,
  blood_pressure_systolic_max INTEGER DEFAULT 140,
  blood_pressure_diastolic_min INTEGER DEFAULT 60,
  blood_pressure_diastolic_max INTEGER DEFAULT 90,
  pulse_min INTEGER DEFAULT 60,
  pulse_max INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 従業員マスタテーブル
CREATE TABLE staff_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_users_master_normalized_name ON users_master(normalized_name);
CREATE INDEX idx_staff_master_normalized_name ON staff_master(normalized_name);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_master_updated_at 
    BEFORE UPDATE ON users_master 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_master_updated_at 
    BEFORE UPDATE ON staff_master 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) の設定
ALTER TABLE users_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_master ENABLE ROW LEVEL SECURITY;

-- 全てのユーザーが読み書きできるポリシー（開発用）
CREATE POLICY "Enable all operations for all users" ON users_master
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for all users" ON staff_master
    FOR ALL USING (true) WITH CHECK (true);