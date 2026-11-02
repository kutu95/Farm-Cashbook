-- Link each electricity bill to the cashbook expense created from it.
-- Deleting an expense clears the link. Deleting a bill leaves the expense in place.

ALTER TABLE public.electricity_bills
  ADD COLUMN IF NOT EXISTS expense_id UUID;

ALTER TABLE public.electricity_bills
  DROP CONSTRAINT IF EXISTS electricity_bills_expense_id_fkey;

ALTER TABLE public.electricity_bills
  ADD CONSTRAINT electricity_bills_expense_id_fkey
  FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE SET NULL;

ALTER TABLE public.electricity_bills
  DROP CONSTRAINT IF EXISTS electricity_bills_expense_id_key;

ALTER TABLE public.electricity_bills
  ADD CONSTRAINT electricity_bills_expense_id_key UNIQUE (expense_id);

COMMENT ON COLUMN public.electricity_bills.expense_id IS 'Cashbook expense posted for this bill. Null until the expense is recorded.';
