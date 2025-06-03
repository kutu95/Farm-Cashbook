-- Add electricity_account_number column to parties table
ALTER TABLE parties ADD COLUMN IF NOT EXISTS electricity_account_number TEXT;

-- Add check constraint for electricity account number format
ALTER TABLE parties ADD CONSTRAINT electricity_account_number_format 
  CHECK (
    electricity_account_number IS NULL OR 
    (LENGTH(electricity_account_number) BETWEEN 9 AND 12 AND 
     electricity_account_number ~ '^[A-Za-z0-9]+$')
  );

COMMENT ON COLUMN parties.electricity_account_number IS 'Optional electricity account number. Must be 9-12 alphanumeric characters.'; 