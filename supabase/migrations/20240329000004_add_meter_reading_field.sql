-- Add meter_reading field to electricity_bills table
ALTER TABLE electricity_bills ADD COLUMN IF NOT EXISTS meter_reading DECIMAL(10,2);

-- Add comment for the new field
COMMENT ON COLUMN electricity_bills.meter_reading IS 'Current meter reading from the electricity bill';
