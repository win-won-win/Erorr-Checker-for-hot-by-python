-- Add print_datetime column to service_records table
ALTER TABLE service_records 
ADD COLUMN print_datetime TIMESTAMPTZ NULL;

-- Add comment to the column
COMMENT ON COLUMN service_records.print_datetime IS '印刷日時 - 印刷ボタンが押された時刻を記録';

-- Create index for efficient querying of printed/unprinted records
CREATE INDEX idx_service_records_print_datetime ON service_records(print_datetime);