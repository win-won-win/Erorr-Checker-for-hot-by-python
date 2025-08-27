/*
  # csv_service_recordsテーブルにpattern_idカラム追加

  ## 概要
  週間パターン自動作成機能で、csv_service_recordsテーブルの各レコードに
  どのパターンが適用されたかを追跡するためのpattern_idカラムを追加する。

  ## 変更内容
  1. csv_service_recordsテーブルにpattern_idカラムを追加
  2. service_patternsテーブルへの外部キー制約を設定
  3. パフォーマンス向上のためのインデックスを追加
*/

-- csv_service_recordsテーブルにpattern_idカラムを追加
ALTER TABLE csv_service_records 
ADD COLUMN IF NOT EXISTS pattern_id uuid REFERENCES service_patterns(id);

-- パフォーマンス向上のためのインデックスを追加
CREATE INDEX IF NOT EXISTS idx_csv_service_records_pattern_id 
ON csv_service_records(pattern_id);

-- 完了メッセージ
SELECT 'csv_service_recordsテーブルにpattern_idカラムを追加しました！' as message;