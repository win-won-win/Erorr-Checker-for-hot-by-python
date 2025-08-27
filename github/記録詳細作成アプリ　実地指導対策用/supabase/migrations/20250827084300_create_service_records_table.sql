-- サービス記録テーブルの作成
CREATE TABLE IF NOT EXISTS public.service_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_name TEXT NOT NULL,
    staff_name TEXT,
    service_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER,
    service_content TEXT,
    special_notes TEXT,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    deposit_breakdown TEXT,
    deposit_change DECIMAL(10,2) DEFAULT 0,
    service_details JSONB,
    pattern_id UUID REFERENCES public.service_patterns(id) ON DELETE SET NULL,
    csv_record_id UUID REFERENCES public.csv_service_records(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_service_records_user_name ON public.service_records(user_name);
CREATE INDEX IF NOT EXISTS idx_service_records_service_date ON public.service_records(service_date);
CREATE INDEX IF NOT EXISTS idx_service_records_pattern_id ON public.service_records(pattern_id);
CREATE INDEX IF NOT EXISTS idx_service_records_csv_record_id ON public.service_records(csv_record_id);

-- RLSポリシーの設定
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

-- 全てのユーザーが読み取り可能
CREATE POLICY "service_records_select_policy" ON public.service_records
    FOR SELECT USING (true);

-- 全てのユーザーが挿入可能
CREATE POLICY "service_records_insert_policy" ON public.service_records
    FOR INSERT WITH CHECK (true);

-- 全てのユーザーが更新可能
CREATE POLICY "service_records_update_policy" ON public.service_records
    FOR UPDATE USING (true);

-- 全てのユーザーが削除可能
CREATE POLICY "service_records_delete_policy" ON public.service_records
    FOR DELETE USING (true);

-- updated_atの自動更新トリガー
CREATE OR REPLACE FUNCTION update_service_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_records_updated_at_trigger
    BEFORE UPDATE ON public.service_records
    FOR EACH ROW
    EXECUTE FUNCTION update_service_records_updated_at();