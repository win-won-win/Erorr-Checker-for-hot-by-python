/*
  # csv_service_recordsテーブル スキーマ修正マイグレーション
  
  ## 問題
  csv_service_recordsテーブルに以下のカラムが存在しないため、
  CSV取り込み処理でエラーが発生している：
  - is_pattern_assigned (28箇所で使用)
  - user_code (31箇所で使用)
  
  ## 解決策
  不足しているカラムを追加し、既存データに適切な値を設定する。
*/

-- csv_service_recordsテーブルに不足しているカラムを追加
ALTER TABLE csv_service_records 
ADD COLUMN IF NOT EXISTS is_pattern_assigned boolean DEFAULT false;

ALTER TABLE csv_service_records 
ADD COLUMN IF NOT EXISTS user_code text DEFAULT '';

-- 既存データのis_pattern_assignedを更新（pattern_idがnullでない場合はtrue）
UPDATE csv_service_records 
SET is_pattern_assigned = (pattern_id IS NOT NULL)
WHERE is_pattern_assigned IS NULL OR is_pattern_assigned = false;

-- 既存データのuser_codeを更新（usersテーブルから取得）
UPDATE csv_service_records 
SET user_code = COALESCE(
  (SELECT u.user_code 
   FROM users u 
   WHERE u.id = csv_service_records.user_id 
   LIMIT 1), 
  ''
)
WHERE user_code = '' OR user_code IS NULL;

-- パフォーマンス向上のためのインデックスを追加
CREATE INDEX IF NOT EXISTS idx_csv_service_records_is_pattern_assigned 
ON csv_service_records(is_pattern_assigned);

CREATE INDEX IF NOT EXISTS idx_csv_service_records_user_code 
ON csv_service_records(user_code);

-- 完了メッセージ
SELECT 'csv_service_recordsテーブルのスキーマ修正が完了しました！' as message;