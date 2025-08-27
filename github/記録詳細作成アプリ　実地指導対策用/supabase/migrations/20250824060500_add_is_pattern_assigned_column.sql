/*
  # is_pattern_assignedカラム追加マイグレーション
  
  ## 問題
  csv_service_recordsテーブルにis_pattern_assignedカラムが存在しないため、
  CSV取り込み処理でエラーが発生している。
  
  ## 解決策
  csv_service_recordsテーブルにis_pattern_assignedカラムを追加し、
  既存データに対してpattern_idの有無に基づいて値を設定する。
*/

-- csv_service_recordsテーブルにis_pattern_assignedカラムを追加
ALTER TABLE csv_service_records 
ADD COLUMN IF NOT EXISTS is_pattern_assigned boolean DEFAULT false;

-- 既存データのis_pattern_assignedを更新（pattern_idがnullでない場合はtrue）
UPDATE csv_service_records 
SET is_pattern_assigned = (pattern_id IS NOT NULL)
WHERE is_pattern_assigned IS NULL OR is_pattern_assigned = false;

-- インデックスを追加してパフォーマンスを向上
CREATE INDEX IF NOT EXISTS idx_csv_service_records_is_pattern_assigned 
ON csv_service_records(is_pattern_assigned);

-- 完了メッセージ
SELECT 'is_pattern_assignedカラムの追加が完了しました！' as message;