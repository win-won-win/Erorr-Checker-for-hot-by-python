/*
  # 介護サービス提供記録管理システム初期スキーマ

  1. New Tables
    - `users` (利用者)
      - `id` (uuid, primary key)
      - `name` (text, 氏名)
      - `name_kana` (text, 氏名カナ)
      - `user_code` (text, 利用者コード)
      - `care_level` (text, 要介護度)
      - `insurance_number` (text, 保険者番号)
      - `insured_number` (text, 被保険者番号)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `staff` (職員)
      - `id` (uuid, primary key)
      - `name` (text, 氏名)
      - `staff_code` (text, 職員コード)
      - `email` (text, メールアドレス)
      - `is_service_manager` (boolean, サービス提供責任者フラグ)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `service_patterns` (サービスパターン)
      - `id` (uuid, primary key)
      - `pattern_name` (text, パターン名)
      - `pattern_details` (jsonb, チェック項目)
      - `description` (text, 説明)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `service_schedules` (サービス予定)
      - `id` (uuid, primary key)
      - `user_id` (uuid, 利用者ID)
      - `staff_id` (uuid, 担当職員ID)
      - `service_date` (date, サービス日)
      - `start_time` (time, 開始時間)
      - `end_time` (time, 終了時間)
      - `service_type` (text, サービス種類)
      - `service_content` (text, サービス内容)
      - `service_type_code` (text, サービス種類コード)
      - `service_content_code` (text, サービス内容コード)
      - `insurance_units` (integer, 保険単位数)
      - `self_pay_amount` (integer, 自費金額)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `service_records` (サービス実施記録)
      - `id` (uuid, primary key)
      - `schedule_id` (uuid, 予定ID)
      - `user_id` (uuid, 利用者ID)
      - `staff_id` (uuid, 担当職員ID)
      - `service_date` (date, 実施日)
      - `start_time` (time, 開始時間)
      - `end_time` (time, 終了時間)
      - `record_created_at` (timestamp, 記録作成時間)
      - `service_details` (jsonb, 詳細チェック項目)
      - `special_notes` (text, 特記事項)
      - `deposit_amount` (integer, 預り金)
      - `deposit_breakdown` (text, 預り金内訳)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `csv_import_logs` (CSVインポートログ)
      - `id` (uuid, primary key)
      - `filename` (text, ファイル名)
      - `import_count` (integer, インポート件数)
      - `success_count` (integer, 成功件数)
      - `error_count` (integer, エラー件数)
      - `import_user_id` (uuid, インポート実行者)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- 利用者テーブル
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_kana text NOT NULL,
  user_code text UNIQUE NOT NULL,
  care_level text DEFAULT '',
  insurance_number text DEFAULT '',
  insured_number text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 職員テーブル
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  staff_code text UNIQUE NOT NULL,
  email text DEFAULT '',
  is_service_manager boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- サービスパターンテーブル
CREATE TABLE IF NOT EXISTS service_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,
  pattern_details jsonb DEFAULT '{}',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- サービス予定テーブル
CREATE TABLE IF NOT EXISTS service_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  service_type text NOT NULL,
  service_content text DEFAULT '',
  service_type_code text DEFAULT '',
  service_content_code text DEFAULT '',
  insurance_units integer DEFAULT 0,
  self_pay_amount integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- サービス実施記録テーブル
CREATE TABLE IF NOT EXISTS service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES service_schedules(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  record_created_at timestamptz NOT NULL,
  service_details jsonb DEFAULT '{}',
  special_notes text DEFAULT '',
  deposit_amount integer DEFAULT 0,
  deposit_breakdown text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CSVインポートログテーブル
CREATE TABLE IF NOT EXISTS csv_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  import_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  import_user_id uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_logs ENABLE ROW LEVEL SECURITY;

-- ポリシー作成（認証済みユーザーは全てのデータにアクセス可能）
CREATE POLICY "Authenticated users can access users" ON users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access staff" ON staff
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access service_patterns" ON service_patterns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access service_schedules" ON service_schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access service_records" ON service_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can access csv_import_logs" ON csv_import_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_staff_staff_code ON staff(staff_code);
CREATE INDEX IF NOT EXISTS idx_service_schedules_date ON service_schedules(service_date);
CREATE INDEX IF NOT EXISTS idx_service_records_date ON service_records(service_date);
CREATE INDEX IF NOT EXISTS idx_service_records_schedule_id ON service_records(schedule_id);