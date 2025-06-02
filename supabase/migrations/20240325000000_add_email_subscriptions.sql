-- Create email_subscriptions table
CREATE TABLE IF NOT EXISTS email_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, party_id)
);

-- Add RLS policies
ALTER TABLE email_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
    ON email_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subscriptions"
    ON email_subscriptions FOR ALL
    USING (auth.uid() = user_id);

-- Function to generate statement data for a party
CREATE OR REPLACE FUNCTION public.generate_party_statement(
    p_party_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_party_name text;
    v_opening_balance numeric;
    v_closing_balance numeric;
    v_payment_count integer;
    v_expense_count integer;
BEGIN
    -- Get party name
    SELECT name INTO v_party_name FROM parties WHERE id = p_party_id;

    -- Get counts for debugging
    SELECT COUNT(*) INTO v_payment_count
    FROM payments
    WHERE party_id = p_party_id
    AND payment_date >= p_start_date
    AND payment_date <= p_end_date;

    SELECT COUNT(*) INTO v_expense_count
    FROM expense_allocations ea
    JOIN expenses e ON e.id = ea.expense_id
    WHERE ea.party_id = p_party_id
    AND e.expense_date >= p_start_date
    AND e.expense_date <= p_end_date;

    RAISE NOTICE 'Generating statement for party %, date range: % to %, found % payments and % expenses',
        v_party_name, p_start_date, p_end_date, v_payment_count, v_expense_count;

    -- Calculate opening balance (as of start date)
    SELECT COALESCE(
        (
            SELECT SUM(amount)
            FROM payments
            WHERE party_id = p_party_id
            AND payment_date < p_start_date
        ), 0
    ) - COALESCE(
        (
            SELECT SUM(allocated_amount)
            FROM expense_allocations
            WHERE party_id = p_party_id
            AND expense_id IN (
                SELECT id FROM expenses WHERE expense_date < p_start_date
            )
        ), 0
    ) INTO v_opening_balance;

    -- Calculate closing balance
    SELECT COALESCE(
        (
            SELECT SUM(amount)
            FROM payments
            WHERE party_id = p_party_id
            AND payment_date <= p_end_date
        ), 0
    ) - COALESCE(
        (
            SELECT SUM(allocated_amount)
            FROM expense_allocations
            WHERE party_id = p_party_id
            AND expense_id IN (
                SELECT id FROM expenses WHERE expense_date <= p_end_date
            )
        ), 0
    ) INTO v_closing_balance;

    -- Build the result
    v_result := jsonb_build_object(
        'party_name', v_party_name,
        'period_start', p_start_date,
        'period_end', p_end_date,
        'opening_balance', v_opening_balance,
        'closing_balance', v_closing_balance,
        'transactions', COALESCE(
            (
                SELECT jsonb_agg(t ORDER BY t.date, t.type DESC)
                FROM (
                    -- Payments
                    SELECT 
                        payment_date as date,
                        'payment' as type,
                        description,
                        amount as amount,
                        NULL as allocated_amount
                    FROM payments
                    WHERE party_id = p_party_id
                    AND payment_date >= p_start_date
                    AND payment_date <= p_end_date
                    
                    UNION ALL
                    
                    -- Expenses
                    SELECT 
                        e.expense_date as date,
                        'expense' as type,
                        e.description,
                        e.amount as total_amount,
                        ea.allocated_amount
                    FROM expense_allocations ea
                    JOIN expenses e ON e.id = ea.expense_id
                    WHERE ea.party_id = p_party_id
                    AND e.expense_date >= p_start_date
                    AND e.expense_date <= p_end_date
                ) t
            ),
            '[]'::jsonb
        )
    );

    RETURN v_result;
END;
$$;

-- Add function to handle email sending (this will be called by a cron job)
CREATE OR REPLACE FUNCTION public.send_monthly_statements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription RECORD;
    v_start_date DATE;
    v_end_date DATE;
    v_month_name TEXT;
    v_year_text TEXT;
    v_statements jsonb[];
BEGIN
    -- Calculate the date range for last month
    v_start_date := date_trunc('month', current_date - interval '1 month')::date;
    v_end_date := (date_trunc('month', current_date) - interval '1 day')::date;
    
    -- Get month name and year
    v_month_name := to_char(v_start_date, 'Month');
    v_year_text := to_char(v_start_date, 'YYYY');

    -- Loop through all subscriptions
    FOR subscription IN 
        SELECT DISTINCT es.user_id, array_agg(es.party_id) as party_ids, u.email
        FROM email_subscriptions es
        JOIN auth.users u ON u.id = es.user_id
        GROUP BY es.user_id, u.email
    LOOP
        -- Generate statements for each subscribed party
        SELECT array_agg(generate_party_statement(p_id, v_start_date, v_end_date))
        INTO v_statements
        FROM unnest(subscription.party_ids) p_id;

        -- Send email using Supabase's built-in email sending
        PERFORM net.http_post(
            url := 'https://api.supabase.com/v1/send-email',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', current_setting('app.settings.service_role_key')
            ),
            body := jsonb_build_object(
                'to', subscription.email,
                'from', 'john@streamtime.com.au',
                'subject', 'Monthly Farm Statement(s) for ' || v_month_name || ' ' || v_year_text,
                'text', 'Your monthly farm statements are attached.',
                'html', 'Your monthly farm statements are attached.',
                'attachments', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'filename', stmt->>'party_name' || ' - Statement ' || v_month_name || ' ' || v_year_text || '.pdf',
                            'content', stmt
                        )
                    )
                    FROM unnest(v_statements) stmt
                )
            )
        );
    END LOOP;
END;
$$;

-- Create a cron job to run at midnight on the first of each month
SELECT cron.schedule(
    'monthly-statements',  -- unique job name
    '0 0 1 * *',         -- cron schedule (midnight on 1st of each month)
    'SELECT send_monthly_statements();'
); 