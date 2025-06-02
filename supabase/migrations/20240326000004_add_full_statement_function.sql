-- Function to generate full statement data for a party (no date restrictions)
CREATE OR REPLACE FUNCTION public.generate_full_party_statement(
    p_party_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_party_name text;
    v_closing_balance numeric;
    v_payment_count integer;
    v_expense_count integer;
BEGIN
    -- Get party name
    SELECT name INTO v_party_name FROM parties WHERE id = p_party_id;

    -- Get counts for debugging
    SELECT COUNT(*) INTO v_payment_count
    FROM payments
    WHERE party_id = p_party_id;

    SELECT COUNT(*) INTO v_expense_count
    FROM expense_allocations ea
    JOIN expenses e ON e.id = ea.expense_id
    WHERE ea.party_id = p_party_id;

    RAISE NOTICE 'Generating full statement for party %, found % payments and % expenses',
        v_party_name, v_payment_count, v_expense_count;

    -- Calculate closing balance (all time)
    SELECT COALESCE(
        (
            SELECT SUM(amount)
            FROM payments
            WHERE party_id = p_party_id
        ), 0
    ) - COALESCE(
        (
            SELECT SUM(allocated_amount)
            FROM expense_allocations
            WHERE party_id = p_party_id
        ), 0
    ) INTO v_closing_balance;

    -- Build the result
    v_result := jsonb_build_object(
        'party_name', v_party_name,
        'closing_balance', v_closing_balance,
        'transactions', COALESCE(
            (
                SELECT jsonb_agg(t ORDER BY t.date, t.type DESC)
                FROM (
                    -- Payments
                    SELECT 
                        payment_date as date,
                        'payment' as type,
                        COALESCE(description, 'Payment') as description,
                        COALESCE(amount, 0) as amount,
                        NULL as allocated_amount
                    FROM payments
                    WHERE party_id = p_party_id
                    
                    UNION ALL
                    
                    -- Expenses
                    SELECT 
                        e.expense_date as date,
                        'expense' as type,
                        COALESCE(e.description, 'Expense') as description,
                        COALESCE(e.amount, 0) as total_amount,
                        COALESCE(ea.allocated_amount, 0) as allocated_amount
                    FROM expense_allocations ea
                    JOIN expenses e ON e.id = ea.expense_id
                    WHERE ea.party_id = p_party_id
                ) t
            ),
            '[]'::jsonb
        )
    );

    -- Validate the result before returning
    IF v_result->>'party_name' IS NULL THEN
        RAISE EXCEPTION 'Invalid party name';
    END IF;

    IF v_result->'transactions' IS NULL THEN
        v_result := jsonb_set(v_result, '{transactions}', '[]'::jsonb);
    END IF;

    RETURN v_result;
END;
$$;

-- Update the send_statements_on_demand function to use the new full statement function
CREATE OR REPLACE FUNCTION public.send_statements_on_demand(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_month_name TEXT;
    v_year_text TEXT;
    v_statements jsonb[];
    v_user_email TEXT;
    v_result jsonb;
BEGIN
    -- Get user's email
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = p_user_id;

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Get month name and year for the filename
    v_month_name := to_char(current_date, 'Month');
    v_year_text := to_char(current_date, 'YYYY');

    -- Generate statements for each subscribed party using the new function
    WITH party_statements AS (
        SELECT 
            p.id as party_id,
            p.name as party_name,
            generate_full_party_statement(p.id) as statement_data
        FROM email_subscriptions es
        JOIN parties p ON p.id = es.party_id
        WHERE es.user_id = p_user_id
    )
    SELECT array_agg(
        jsonb_build_object(
            'party_id', party_id,
            'party_name', party_name,
            'statement_data', statement_data
        )
    )
    INTO v_statements
    FROM party_statements;

    IF v_statements IS NULL OR array_length(v_statements, 1) IS NULL THEN
        RAISE EXCEPTION 'No subscribed statements found';
    END IF;

    -- Build the result
    v_result := jsonb_build_object(
        'statements', v_statements,
        'count', array_length(v_statements, 1),
        'email', v_user_email,
        'month', v_month_name,
        'year', v_year_text
    );

    RETURN v_result;
END;
$$; 