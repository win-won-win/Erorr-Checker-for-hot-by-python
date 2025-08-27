-- 介護サービス提供記録管理システム データベース完全セットアップ
-- 既存データをクリアしてから新しいスキーマを適用

-- 既存のテーブルを削除（依存関係の順序で削除）
DROP TABLE IF EXISTS csv_service_records CASCADE;
DROP TABLE IF EXISTS service_records CASCADE;
DROP TABLE IF EXISTS service_schedules CASCADE;
DROP TABLE IF EXISTS service_patterns CASCADE;
DROP TABLE IF EXISTS comment_templates CASCADE;
DROP TABLE IF EXISTS csv_import_logs CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. users（利用者テーブル）
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- 利用者名（必須）
  birth_date date,                       -- 生年月日
  user_code text UNIQUE,                 -- 利用者コード
  name_kana text DEFAULT '',             -- 氏名カナ
  care_level text DEFAULT '',            -- 要介護度
  insurance_number text DEFAULT '',      -- 保険者番号
  insured_number text DEFAULT '',        -- 被保険者番号
  address text DEFAULT '',               -- 住所
  phone text DEFAULT '',                 -- 電話番号
  emergency_contact text DEFAULT '',     -- 緊急連絡先
  notes text DEFAULT '',                 -- 備考
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. staff（従業員テーブル）
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- 従業員名（必須）
  birth_date date,                       -- 生年月日
  staff_code text UNIQUE,                -- 職員コード
  email text DEFAULT '',                 -- メールアドレス
  phone text DEFAULT '',                 -- 電話番号
  address text DEFAULT '',               -- 住所
  hire_date date,                        -- 入社日
  is_service_manager boolean DEFAULT false, -- サービス提供責任者フラグ
  qualification text DEFAULT '',         -- 資格
  notes text DEFAULT '',                 -- 備考
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. facilities（施設テーブル）
CREATE TABLE facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- 事業所名（必須）
  address text DEFAULT '',               -- 事業所所在地
  phone text DEFAULT '',                 -- 電話番号
  fax text DEFAULT '',                   -- FAX番号
  email text DEFAULT '',                 -- メールアドレス
  license_number text DEFAULT '',        -- 事業所番号
  manager_name text DEFAULT '',          -- 管理者名
  notes text DEFAULT '',                 -- 備考
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. service_patterns（パターン保管テーブル）
CREATE TABLE service_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,            -- パターン名
  user_id uuid REFERENCES users(id),     -- 利用者ID（リレーション）
  start_time time,                       -- 開始時間
  end_time time,                         -- 終了時間
  pattern_details jsonb DEFAULT '{}',    -- パターン詳細（JSON）
  description text DEFAULT '',           -- 説明
  usage_count integer DEFAULT 0,         -- 使用回数
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. comment_templates（一言コメント定型文テーブル）
CREATE TABLE comment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_text text NOT NULL,            -- コメント内容
  comment_group text NOT NULL,           -- グループ（体調良好/体調不良/普通/その他）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. csv_service_records（CSV取り込み用サービス記録テーブル）
CREATE TABLE csv_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),              -- 利用者ID（リレーション）
  staff_id uuid REFERENCES staff(id),             -- 従業員ID（リレーション）
  facility_id uuid REFERENCES facilities(id),     -- 施設ID（リレーション）
  pattern_id uuid REFERENCES service_patterns(id), -- パターンID（リレーション）
  comment_template_id uuid REFERENCES comment_templates(id), -- コメントテンプレートID
  
  -- CSV基本データ
  user_name text NOT NULL,               -- 利用者名（CSV由来）
  staff_name text NOT NULL,              -- 担当職員名（CSV由来）
  start_time time NOT NULL,              -- 開始時間
  end_time time NOT NULL,                -- 終了時間
  duration_minutes integer NOT NULL,     -- 実施時間（分）
  service_date date NOT NULL,            -- 西暦日付（YYYY-MM-DD）
  service_content text DEFAULT '',       -- サービス内容
  
  -- 自動生成・管理データ
  special_notes text DEFAULT '',         -- 特記事項（定型文から自動選択）
  record_created_at timestamptz,         -- 記録作成日時（ランダム生成、手動記録時上書き）
  print_datetime timestamptz,            -- 印刷日時（1週間に1度自動、手動印刷時上書き）
  
  -- 詳細記録データ
  service_details jsonb DEFAULT '{}',    -- サービス詳細（パターンから自動設定）
  
  -- メタデータ
  is_manually_created boolean DEFAULT false, -- 手動作成フラグ
  csv_import_batch_id text,              -- CSV一括取り込みバッチID
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. csv_import_logs（CSVインポートログテーブル）
CREATE TABLE csv_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  import_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  import_user_id uuid,
  created_at timestamptz DEFAULT now()
);

-- インデックス作成
CREATE INDEX idx_users_user_code ON users(user_code);
CREATE INDEX idx_staff_staff_code ON staff(staff_code);
CREATE INDEX idx_csv_service_records_date ON csv_service_records(service_date);
CREATE INDEX idx_csv_service_records_user_id ON csv_service_records(user_id);
CREATE INDEX idx_csv_service_records_staff_id ON csv_service_records(staff_id);

-- Row Level Security (RLS) 有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー作成（全テーブル共通：認証済みユーザーは全操作可能）
CREATE POLICY "Allow all operations for authenticated users on users" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on users" ON users FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on staff" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on staff" ON staff FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on facilities" ON facilities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on facilities" ON facilities FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on service_patterns" ON service_patterns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on service_patterns" ON service_patterns FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on comment_templates" ON comment_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on comment_templates" ON comment_templates FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on csv_service_records" ON csv_service_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on csv_service_records" ON csv_service_records FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on csv_import_logs" ON csv_import_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for anonymous users on csv_import_logs" ON csv_import_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- サンプルデータ挿入

-- 施設データ
INSERT INTO facilities (name, address, phone, manager_name) VALUES
('さくらケアサービス', '東京都渋谷区1-1-1', '03-1234-5678', '管理者 太郎');

-- 利用者サンプルデータ
INSERT INTO users (name, user_code, name_kana, care_level) VALUES
('持田 郁恵', '2304202661', 'モチダ イクエ', '要介護2'),
('志太 博之', '1700057072', 'シダ ヒロユキ', '要介護1'),
('村田 美雪', '2204435116', 'ムラタ ミユキ', '要介護3'),
('森 秀昭', '2208296785', 'モリ ヒデアキ', '要介護2');

-- 従業員サンプルデータ
INSERT INTO staff (name, staff_code, is_service_manager) VALUES
('渡邉 由可里', '2500142318', true),
('笠間 京子', '1644', false),
('佐藤 太郎', '148841', false),
('鈴木 美香', '215442', false);

-- 一言コメント定型文（各グループ15件ずつ）

-- 体調良好グループ
INSERT INTO comment_templates (comment_text, comment_group) VALUES
('本日も元気にお過ごしでした。', '体調良好'),
('笑顔でサービスを受けられました。', '体調良好'),
('体調良好で積極的に参加されました。', '体調良好'),
('お元気で会話も弾みました。', '体調良好'),
('とても調子が良さそうでした。', '体調良好'),
('明るい表情でお過ごしでした。', '体調良好'),
('体調に問題なく過ごされました。', '体調良好'),
('いつも通り元気にされていました。', '体調良好'),
('健康状態は良好です。', '体調良好'),
('お変わりなくお元気でした。', '体調良好'),
('体調面で心配なことはありませんでした。', '体調良好'),
('活気があり調子が良さそうでした。', '体調良好'),
('穏やかにお過ごしでした。', '体調良好'),
('体調は安定しています。', '体調良好'),
('今日も元気いっぱいでした。', '体調良好');

-- 普通グループ
INSERT INTO comment_templates (comment_text, comment_group) VALUES
('いつも通りお過ごしでした。', '普通'),
('特に変わりなくお過ごしでした。', '普通'),
('普段通りのご様子でした。', '普通'),
('落ち着いてお過ごしでした。', '普通'),
('平常通りでした。', '普通'),
('いつものペースでお過ごしでした。', '普通'),
('特に問題なくお過ごしでした。', '普通'),
('安定したご様子でした。', '普通'),
('変わりなくお過ごしでした。', '普通'),
('通常通りのご様子でした。', '普通'),
('穏やかにお過ごしでした。', '普通'),
('いつものようにお過ごしでした。', '普通'),
('特記すべきことはありませんでした。', '普通'),
('平穏にお過ごしでした。', '普通'),
('いつも通りの一日でした。', '普通');

-- 体調不良グループ
INSERT INTO comment_templates (comment_text, comment_group) VALUES
('少し疲れ気味のご様子でした。', '体調不良'),
('体調がすぐれないようでした。', '体調不良'),
('いつもより元気がありませんでした。', '体調不良'),
('お疲れのご様子でした。', '体調不良'),
('体調面で心配な様子が見られました。', '体調不良'),
('少し調子が悪そうでした。', '体調不良'),
('体調の変化に注意が必要です。', '体調不良'),
('いつもより静かでした。', '体調不良'),
('体調管理に気をつけていただきたいです。', '体調不良'),
('少し体調を崩されているようでした。', '体調不良'),
('お身体の調子が気になりました。', '体調不良'),
('体調面での観察が必要です。', '体調不良'),
('いつもより食欲がないようでした。', '体調不良'),
('体調の回復をお祈りしています。', '体調不良'),
('無理をされないよう注意が必要です。', '体調不良');

-- その他グループ
INSERT INTO comment_templates (comment_text, comment_group) VALUES
('ご家族との時間を大切にされていました。', 'その他'),
('新しいことに挑戦されていました。', 'その他'),
('趣味の話で盛り上がりました。', 'その他'),
('季節の話題で会話が弾みました。', 'その他'),
('お孫さんの話をされていました。', 'その他'),
('昔の思い出話をされていました。', 'その他'),
('お気に入りのテレビ番組を楽しまれていました。', 'その他'),
('お花の手入れを楽しまれていました。', 'その他'),
('読書を楽しまれていました。', 'その他'),
('音楽を聴いてリラックスされていました。', 'その他'),
('お料理の話で盛り上がりました。', 'その他'),
('近所の方との交流を楽しまれていました。', 'その他'),
('散歩を楽しまれていました。', 'その他'),
('手芸を楽しまれていました。', 'その他'),
('写真を見ながら思い出話をされていました。', 'その他');

-- 完了メッセージ
SELECT 'データベースセットアップが完了しました！' as message;