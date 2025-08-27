-- service_recordsテーブルにservice_typeカラムを追加
ALTER TABLE public.service_records 
ADD COLUMN IF NOT EXISTS service_type TEXT;

-- service_typeカラムにインデックスを作成
CREATE INDEX IF NOT EXISTS idx_service_records_service_type ON public.service_records(service_type);