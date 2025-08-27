-- 利用者マスタテーブル
CREATE TABLE users_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  -- 健康チェック基準値
  temperature_base DECIMAL(3,1) DEFAULT 36.5, -- 基準体温
  temperature_range DECIMAL(2,1) DEFAULT 0.5, -- 体温の変動幅
  systolic_bp_base INTEGER DEFAULT 120, -- 基準収縮期血圧
  systolic_bp_range INTEGER DEFAULT 20, -- 収縮期血圧の変動幅
  diastolic_bp_base INTEGER DEFAULT 80, -- 基準拡張期血圧
  diastolic_bp_range INTEGER DEFAULT 15, -- 拡張期血圧の変動幅
  pulse_base INTEGER DEFAULT 70, -- 基準脈拍
  pulse_range INTEGER DEFAULT 15, -- 脈拍の変動幅
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