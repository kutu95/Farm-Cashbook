-- Create electricity_bills table
CREATE TABLE IF NOT EXISTS electricity_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_date DATE NOT NULL,
  bill_date_range_start DATE NOT NULL,
  bill_date_range_end DATE NOT NULL,
  total_units_consumed DECIMAL(10,2) NOT NULL,
  units_per_day DECIMAL(10,4),
  is_estimated BOOLEAN DEFAULT false,
  account_number TEXT NOT NULL,
  bill_amount DECIMAL(10,2) NOT NULL,
  pdf_file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for bill date range and account number combination
ALTER TABLE electricity_bills ADD CONSTRAINT electricity_bills_unique_range_account 
  UNIQUE (bill_date_range_start, bill_date_range_end, account_number);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_electricity_bills_account_number ON electricity_bills(account_number);
CREATE INDEX IF NOT EXISTS idx_electricity_bills_bill_date ON electricity_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_electricity_bills_date_range ON electricity_bills(bill_date_range_start, bill_date_range_end);

-- Add RLS policies
ALTER TABLE electricity_bills ENABLE ROW LEVEL SECURITY;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_electricity_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_electricity_bills_updated_at
  BEFORE UPDATE ON electricity_bills
  FOR EACH ROW
  EXECUTE FUNCTION update_electricity_bills_updated_at();

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage electricity bills" ON electricity_bills
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can view electricity bills
CREATE POLICY "Users can view electricity bills" ON electricity_bills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE electricity_bills IS 'Stores electricity bill data extracted from PDF bills';
COMMENT ON COLUMN electricity_bills.bill_date IS 'The date the bill was issued';
COMMENT ON COLUMN electricity_bills.bill_date_range_start IS 'Start date of the billing period';
COMMENT ON COLUMN electricity_bills.bill_date_range_end IS 'End date of the billing period';
COMMENT ON COLUMN electricity_bills.total_units_consumed IS 'Total electricity units consumed in kWh';
COMMENT ON COLUMN electricity_bills.units_per_day IS 'Average units consumed per day during the billing period';
COMMENT ON COLUMN electricity_bills.is_estimated IS 'Indicates if the meter reading was estimated (true) or actual (false)';
COMMENT ON COLUMN electricity_bills.account_number IS 'Electricity account number';
COMMENT ON COLUMN electricity_bills.bill_amount IS 'Total cost of the bill in dollars';
COMMENT ON COLUMN electricity_bills.pdf_file_path IS 'Path to the uploaded PDF file';
