-- Update the record_audit_log function to include user email
CREATE OR REPLACE FUNCTION record_audit_log(
    p_action audit_action,
    p_table_name TEXT DEFAULT NULL,
    p_record_id UUID DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_additional_info JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_audit_id UUID;
    v_user_email TEXT;
    v_final_info JSONB;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    -- Get user email
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;
    
    -- Merge additional info with user email
    v_final_info := COALESCE(p_additional_info, '{}'::jsonb) || 
                    jsonb_build_object('user_email', v_user_email);
    
    -- Insert audit log
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        additional_info
    ) VALUES (
        v_user_id,
        p_action,
        p_table_name,
        p_record_id,
        p_old_data,
        p_new_data,
        v_final_info
    )
    RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$; 