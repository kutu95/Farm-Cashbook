-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.send_statements_on_demand(UUID);

-- Create the new function without using net schema
CREATE OR REPLACE FUNCTION public.send_statements_on_demand(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
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

    -- Calculate the date range for current month
    v_start_date := date_trunc('month', current_date)::date;
    v_end_date := current_date;
    
    -- Get month name and year
    v_month_name := to_char(current_date, 'Month');
    v_year_text := to_char(current_date, 'YYYY');

    -- Generate statements for each subscribed party
    WITH party_statements AS (
        SELECT 
            p.id as party_id,
            p.name as party_name,
            generate_party_statement(p.id, v_start_date, v_end_date) as statement_data
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