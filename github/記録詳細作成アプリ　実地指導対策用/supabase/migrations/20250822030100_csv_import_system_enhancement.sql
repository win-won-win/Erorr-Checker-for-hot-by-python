/*
  # CSV取り込みシステム強化マイグレーション
  
  ## 概要
  Architectモードで設計されたCSV取り込みシステムの強化機能を実装
  
  ## 実装内容
  1. 既存テーブルの修正（4テーブル）
     - users: 正規化名前フィールド、プロファイル情報追加
     - staff: 正規化名前フィールド、プロファイル情報追加
     - csv_service_records: 処理状態、生成データ追跡フィールド追加
     - service_patterns: 自動適用設定、使用統計フィールド追加
  
  2. 新規テーブル追加（10テーブル）
     - 名前管理系: name_variations, name_resolution_history
     - パターン学習系: pattern_learning_data, pattern_application_history
     - 処理管理系: csv_import_jobs, csv_import_errors, unlinked_data_tracking
     - 集計管理系: monthly_data_summaries, daily_data_summaries
     - 自動生成系: auto_generation_configs, generation_history
  
  3. インデックス、RLS、ポリシーの設定
*/

-- ============================================================================
-- 1. 既存テーブルの修正
-- ============================================================================

-- 1.1 usersテーブルの拡張
ALTER TABLE users ADD COLUMN IF NOT EXISTS normalized_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_reading text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_data jsonb DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS matching_confidence decimal(3,2) DEFAULT 1.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_matched_at timestamptz;

-- 1.2 staffテーブルの拡張
ALTER TABLE staff ADD COLUMN IF NOT EXISTS normalized_name text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS name_reading text DEFAULT '';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_data jsonb DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS matching_confidence decimal(3,2) DEFAULT 1.0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_matched_at timestamptz;

-- 1.3 csv_service_recordsテーブルの拡張
ALTER TABLE csv_service_records ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending';
ALTER TABLE csv_service_records ADD COLUMN IF NOT EXISTS error_details jsonb DEFAULT '{}';
ALTER TABLE csv_service_records ADD COLUMN IF NOT EXISTS auto_generated_fields jsonb DEFAULT '{}';
ALTER TABLE csv_service_records ADD COLUMN IF NOT EXISTS generation_metadata jsonb DEFAULT '{}';
ALTER TABLE csv_service_records ADD COLUMN IF NOT EXISTS quality_score decimal(3,2);
ALTER TABLE csv_service_records ADD COLUMN IF NOT EXISTS validation_errors jsonb DEFAULT '[]';

-- 1.4 service_patternsテーブルの拡張
ALTER TABLE service_patterns ADD COLUMN IF NOT EXISTS auto_apply_enabled boolean DEFAULT false;
ALTER TABLE service_patterns ADD COLUMN IF NOT EXISTS auto_apply_conditions jsonb DEFAULT '{}';
ALTER TABLE service_patterns ADD COLUMN IF NOT EXISTS success_rate decimal(5,2) DEFAULT 0.0;
ALTER TABLE service_patterns ADD COLUMN IF NOT EXISTS last_applied_at timestamptz;
ALTER TABLE service_patterns ADD COLUMN IF NOT EXISTS application_count integer DEFAULT 0;

-- ============================================================================
-- 2. 新規テーブル作成
-- ============================================================================

-- 2.1 名前管理系テーブル

-- 名前バリエーション管理テーブル
CREATE TABLE IF NOT EXISTS name_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name text NOT NULL,
  normalized_name text NOT NULL,
  variation_type text NOT NULL, -- 'kanji', 'kana', 'romaji', 'nickname'
  confidence_score decimal(3,2) DEFAULT 1.0,
  source_type text NOT NULL, -- 'csv', 'manual', 'auto_detected'
  user_id uuid REFERENCES users(id),
  staff_id uuid REFERENCES staff(id),
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 名前解決履歴テーブル
CREATE TABLE IF NOT EXISTS name_resolution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_name text NOT NULL,
  resolved_name text NOT NULL,
  resolution_method text NOT NULL, -- 'exact_match', 'fuzzy_match', 'manual', 'ai_assisted'
  confidence_score decimal(3,2) NOT NULL,
  user_id uuid REFERENCES users(id),
  staff_id uuid REFERENCES staff(id),
  resolver_user_id uuid, -- 解決を行ったユーザー
  resolution_time_ms integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 2.2 パターン学習系テーブル

-- パターン学習データテーブル
CREATE TABLE IF NOT EXISTS pattern_learning_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid REFERENCES service_patterns(id) NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  input_data jsonb NOT NULL,
  expected_output jsonb NOT NULL,
  actual_output jsonb,
  success boolean,
  learning_weight decimal(3,2) DEFAULT 1.0,
  feature_vector jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- パターン適用履歴テーブル
CREATE TABLE IF NOT EXISTS pattern_application_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid REFERENCES service_patterns(id) NOT NULL,
  csv_record_id uuid REFERENCES csv_service_records(id),
  user_id uuid REFERENCES users(id) NOT NULL,
  application_type text NOT NULL, -- 'auto', 'manual', 'suggested'
  success boolean NOT NULL,
  confidence_score decimal(3,2),
  execution_time_ms integer,
  input_context jsonb DEFAULT '{}',
  output_result jsonb DEFAULT '{}',
  error_details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 2.3 処理管理系テーブル

-- CSV取り込みジョブ管理テーブル
CREATE TABLE IF NOT EXISTS csv_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_size bigint,
  file_hash text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  successful_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  progress_percentage decimal(5,2) DEFAULT 0.0,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_completion_at timestamptz,
  processing_options jsonb DEFAULT '{}',
  error_summary jsonb DEFAULT '{}',
  created_by uuid, -- 実行ユーザー
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CSV取り込みエラー管理テーブル
CREATE TABLE IF NOT EXISTS csv_import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES csv_import_jobs(id) NOT NULL,
  row_number integer NOT NULL,
  error_type text NOT NULL, -- 'validation', 'parsing', 'constraint', 'business_logic'
  error_code text,
  error_message text NOT NULL,
  field_name text,
  field_value text,
  severity text DEFAULT 'error', -- 'warning', 'error', 'critical'
  is_resolved boolean DEFAULT false,
  resolution_method text,
  resolved_by uuid,
  resolved_at timestamptz,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 未紐付けデータ追跡テーブル
CREATE TABLE IF NOT EXISTS unlinked_data_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  csv_record_id uuid REFERENCES csv_service_records(id) NOT NULL,
  unlinked_type text NOT NULL, -- 'user', 'staff', 'pattern', 'facility'
  original_value text NOT NULL,
  suggested_matches jsonb DEFAULT '[]',
  match_attempts integer DEFAULT 0,
  last_attempt_at timestamptz,
  resolution_status text DEFAULT 'pending', -- 'pending', 'resolved', 'ignored', 'manual_required'
  resolved_value text,
  resolved_id uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.4 集計管理系テーブル

-- 月別データ集計テーブル
CREATE TABLE IF NOT EXISTS monthly_data_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  user_id uuid REFERENCES users(id),
  staff_id uuid REFERENCES staff(id),
  total_records integer DEFAULT 0,
  total_service_hours decimal(8,2) DEFAULT 0.0,
  average_service_duration decimal(6,2) DEFAULT 0.0,
  unique_service_days integer DEFAULT 0,
  most_common_service_type text,
  quality_metrics jsonb DEFAULT '{}',
  generated_records integer DEFAULT 0,
  manual_records integer DEFAULT 0,
  error_rate decimal(5,2) DEFAULT 0.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, month, user_id, staff_id)
);

-- 日別データ集計テーブル
CREATE TABLE IF NOT EXISTS daily_data_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date date NOT NULL,
  user_id uuid REFERENCES users(id),
  staff_id uuid REFERENCES staff(id),
  total_records integer DEFAULT 0,
  total_service_hours decimal(6,2) DEFAULT 0.0,
  service_types jsonb DEFAULT '[]',
  quality_score decimal(3,2),
  generated_records integer DEFAULT 0,
  manual_records integer DEFAULT 0,
  processing_time_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(summary_date, user_id, staff_id)
);

-- 2.5 自動生成系テーブル

-- 自動生成設定テーブル
CREATE TABLE IF NOT EXISTS auto_generation_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name text NOT NULL UNIQUE,
  config_type text NOT NULL, -- 'time_generation', 'content_generation', 'pattern_application'
  is_enabled boolean DEFAULT true,
  target_tables text[] DEFAULT '{}',
  generation_rules jsonb NOT NULL DEFAULT '{}',
  schedule_config jsonb DEFAULT '{}', -- cron式など
  success_rate decimal(5,2) DEFAULT 0.0,
  last_executed_at timestamptz,
  next_execution_at timestamptz,
  execution_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 生成履歴テーブル
CREATE TABLE IF NOT EXISTS generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES auto_generation_configs(id) NOT NULL,
  execution_id uuid DEFAULT gen_random_uuid(),
  target_table text NOT NULL,
  target_record_id uuid,
  generation_type text NOT NULL, -- 'create', 'update', 'enhance'
  input_data jsonb DEFAULT '{}',
  generated_data jsonb DEFAULT '{}',
  success boolean NOT NULL,
  quality_score decimal(3,2),
  execution_time_ms integer,
  error_details jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. インデックス作成
-- ============================================================================

-- 既存テーブル用の新しいインデックス
CREATE INDEX IF NOT EXISTS idx_users_normalized_name ON users(normalized_name);
CREATE INDEX IF NOT EXISTS idx_users_matching_confidence ON users(matching_confidence);
CREATE INDEX IF NOT EXISTS idx_staff_normalized_name ON staff(normalized_name);
CREATE INDEX IF NOT EXISTS idx_staff_matching_confidence ON staff(matching_confidence);
CREATE INDEX IF NOT EXISTS idx_csv_service_records_processing_status ON csv_service_records(processing_status);
CREATE INDEX IF NOT EXISTS idx_csv_service_records_quality_score ON csv_service_records(quality_score);
CREATE INDEX IF NOT EXISTS idx_service_patterns_auto_apply ON service_patterns(auto_apply_enabled);
CREATE INDEX IF NOT EXISTS idx_service_patterns_success_rate ON service_patterns(success_rate);

-- 名前管理系インデックス
CREATE INDEX IF NOT EXISTS idx_name_variations_original_name ON name_variations(original_name);
CREATE INDEX IF NOT EXISTS idx_name_variations_normalized_name ON name_variations(normalized_name);
CREATE INDEX IF NOT EXISTS idx_name_variations_user_id ON name_variations(user_id);
CREATE INDEX IF NOT EXISTS idx_name_variations_staff_id ON name_variations(staff_id);
CREATE INDEX IF NOT EXISTS idx_name_resolution_history_input_name ON name_resolution_history(input_name);
CREATE INDEX IF NOT EXISTS idx_name_resolution_history_user_id ON name_resolution_history(user_id);
CREATE INDEX IF NOT EXISTS idx_name_resolution_history_staff_id ON name_resolution_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_name_resolution_history_created_at ON name_resolution_history(created_at);

-- パターン学習系インデックス
CREATE INDEX IF NOT EXISTS idx_pattern_learning_data_pattern_id ON pattern_learning_data(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_learning_data_user_id ON pattern_learning_data(user_id);
CREATE INDEX IF NOT EXISTS idx_pattern_learning_data_success ON pattern_learning_data(success);
CREATE INDEX IF NOT EXISTS idx_pattern_application_history_pattern_id ON pattern_application_history(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_application_history_user_id ON pattern_application_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pattern_application_history_success ON pattern_application_history(success);
CREATE INDEX IF NOT EXISTS idx_pattern_application_history_created_at ON pattern_application_history(created_at);

-- 処理管理系インデックス
CREATE INDEX IF NOT EXISTS idx_csv_import_jobs_status ON csv_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_csv_import_jobs_created_at ON csv_import_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_csv_import_jobs_created_by ON csv_import_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_csv_import_errors_job_id ON csv_import_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_csv_import_errors_error_type ON csv_import_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_csv_import_errors_is_resolved ON csv_import_errors(is_resolved);
CREATE INDEX IF NOT EXISTS idx_unlinked_data_tracking_csv_record_id ON unlinked_data_tracking(csv_record_id);
CREATE INDEX IF NOT EXISTS idx_unlinked_data_tracking_unlinked_type ON unlinked_data_tracking(unlinked_type);
CREATE INDEX IF NOT EXISTS idx_unlinked_data_tracking_resolution_status ON unlinked_data_tracking(resolution_status);

-- 集計管理系インデックス
CREATE INDEX IF NOT EXISTS idx_monthly_data_summaries_year_month ON monthly_data_summaries(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_data_summaries_user_id ON monthly_data_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_data_summaries_staff_id ON monthly_data_summaries(staff_id);
CREATE INDEX IF NOT EXISTS idx_daily_data_summaries_summary_date ON daily_data_summaries(summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_data_summaries_user_id ON daily_data_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_data_summaries_staff_id ON daily_data_summaries(staff_id);

-- 自動生成系インデックス
CREATE INDEX IF NOT EXISTS idx_auto_generation_configs_config_type ON auto_generation_configs(config_type);
CREATE INDEX IF NOT EXISTS idx_auto_generation_configs_is_enabled ON auto_generation_configs(is_enabled);
CREATE INDEX IF NOT EXISTS idx_auto_generation_configs_next_execution_at ON auto_generation_configs(next_execution_at);
CREATE INDEX IF NOT EXISTS idx_generation_history_config_id ON generation_history(config_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_execution_id ON generation_history(execution_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_target_table ON generation_history(target_table);
CREATE INDEX IF NOT EXISTS idx_generation_history_success ON generation_history(success);
CREATE INDEX IF NOT EXISTS idx_generation_history_created_at ON generation_history(created_at);

-- ============================================================================
-- 4. Row Level Security (RLS) 有効化
-- ============================================================================

-- 新規テーブルのRLS有効化
ALTER TABLE name_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE name_resolution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlinked_data_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_data_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_data_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_generation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLSポリシー作成
-- ============================================================================

-- 5.1 名前管理系テーブルのポリシー

-- name_variations
CREATE POLICY "Allow all operations for authenticated users on name_variations"
  ON name_variations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on name_variations"
  ON name_variations FOR ALL TO anon USING (true) WITH CHECK (true);

-- name_resolution_history
CREATE POLICY "Allow all operations for authenticated users on name_resolution_history"
  ON name_resolution_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on name_resolution_history"
  ON name_resolution_history FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5.2 パターン学習系テーブルのポリシー

-- pattern_learning_data
CREATE POLICY "Allow all operations for authenticated users on pattern_learning_data"
  ON pattern_learning_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on pattern_learning_data"
  ON pattern_learning_data FOR ALL TO anon USING (true) WITH CHECK (true);

-- pattern_application_history
CREATE POLICY "Allow all operations for authenticated users on pattern_application_history"
  ON pattern_application_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on pattern_application_history"
  ON pattern_application_history FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5.3 処理管理系テーブルのポリシー

-- csv_import_jobs
CREATE POLICY "Allow all operations for authenticated users on csv_import_jobs"
  ON csv_import_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on csv_import_jobs"
  ON csv_import_jobs FOR ALL TO anon USING (true) WITH CHECK (true);

-- csv_import_errors
CREATE POLICY "Allow all operations for authenticated users on csv_import_errors"
  ON csv_import_errors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on csv_import_errors"
  ON csv_import_errors FOR ALL TO anon USING (true) WITH CHECK (true);

-- unlinked_data_tracking
CREATE POLICY "Allow all operations for authenticated users on unlinked_data_tracking"
  ON unlinked_data_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on unlinked_data_tracking"
  ON unlinked_data_tracking FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5.4 集計管理系テーブルのポリシー

-- monthly_data_summaries
CREATE POLICY "Allow all operations for authenticated users on monthly_data_summaries"
  ON monthly_data_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on monthly_data_summaries"
  ON monthly_data_summaries FOR ALL TO anon USING (true) WITH CHECK (true);

-- daily_data_summaries
CREATE POLICY "Allow all operations for authenticated users on daily_data_summaries"
  ON daily_data_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on daily_data_summaries"
  ON daily_data_summaries FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5.5 自動生成系テーブルのポリシー

-- auto_generation_configs
CREATE POLICY "Allow all operations for authenticated users on auto_generation_configs"
  ON auto_generation_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on auto_generation_configs"
  ON auto_generation_configs FOR ALL TO anon USING (true) WITH CHECK (true);

-- generation_history
CREATE POLICY "Allow all operations for authenticated users on generation_history"
  ON generation_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on generation_history"
  ON generation_history FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. 初期データ設定
-- ============================================================================

-- 自動生成設定の初期データ
INSERT INTO auto_generation_configs (config_name, config_type, generation_rules, is_enabled) VALUES
('record_time_generation', 'time_generation', '{"method": "random_within_range", "base_range": {"start": "09:00", "end": "17:00"}, "variation_minutes": 30}', true),
('service_content_enhancement', 'content_generation', '{"templates": ["basic_care", "medical_support", "daily_assistance"], "auto_select": true}', true),
('pattern_auto_application', 'pattern_application', '{"confidence_threshold": 0.8, "auto_apply": true, "learning_enabled": true}', true);

-- 完了メッセージ
SELECT 'CSV取り込みシステム強化マイグレーションが完了しました！' as message;