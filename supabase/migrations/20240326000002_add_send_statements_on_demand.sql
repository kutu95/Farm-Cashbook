-- Function to send statements on demand for a specific user
CREATE OR REPLACE FUNCTION public.send_statements_on_demand(p_user_id UUID)
RETURNS void
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
    SELECT array_agg(generate_party_statement(party_id, v_start_date, v_end_date))
    INTO v_statements
    FROM email_subscriptions
    WHERE user_id = p_user_id;

    IF v_statements IS NULL OR array_length(v_statements, 1) IS NULL THEN
        RAISE EXCEPTION 'No subscribed statements found';
    END IF;

    -- Send email using Supabase's built-in email sending
    PERFORM net.http_post(
        url := 'https://api.supabase.com/v1/send-email',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
            'to', v_user_email,
            'from', 'john@streamtime.com.au',
            'subject', 'Farm Statement(s) for ' || v_month_name || ' ' || v_year_text,
            'text', 'Your requested farm statements are attached.',
            'html', 'Your requested farm statements are attached.',
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
END;
$$; 