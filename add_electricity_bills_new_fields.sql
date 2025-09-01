-- Add new fields to existing electricity_bills table
ALTER TABLE electricity_bills ADD COLUMN IF NOT EXISTS units_per_day DECIMAL(10,4);
ALTER TABLE electricity_bills ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN DEFAULT false;

-- Add comments for the new fields
COMMENT ON COLUMN electricity_bills.units_per_day IS 'Average units consumed per day during the billing period';
COMMENT ON COLUMN electricity_bills.is_estimated IS 'Indicates if the meter reading was estimated (true) or actual (false)';
