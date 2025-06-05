-- Create an enum for audit action types
CREATE TYPE audit_action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'ROLE_CHANGE',
    'VIEW_STATEMENT',
    'SEND_STATEMENT',
    'PAYMENT_REVERSAL'
);

-- Create the audit log table
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    action audit_action NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    additional_info JSONB
);

-- Add indexes for common query patterns
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- Add RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Function to record an audit log
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

-- Create triggers for automatic audit logging

-- Payments audit trigger
CREATE OR REPLACE FUNCTION audit_payments_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM record_audit_log(
            'INSERT'::audit_action,
            'payments',
            NEW.id,
            NULL,
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM record_audit_log(
            'UPDATE'::audit_action,
            'payments',
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM record_audit_log(
            'DELETE'::audit_action,
            'payments',
            OLD.id,
            to_jsonb(OLD),
            NULL
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER payments_audit
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION audit_payments_trigger();

-- Expenses audit trigger
CREATE OR REPLACE FUNCTION audit_expenses_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM record_audit_log(
            'INSERT'::audit_action,
            'expenses',
            NEW.id,
            NULL,
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM record_audit_log(
            'UPDATE'::audit_action,
            'expenses',
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM record_audit_log(
            'DELETE'::audit_action,
            'expenses',
            OLD.id,
            to_jsonb(OLD),
            NULL
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER expenses_audit
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION audit_expenses_trigger();

-- User roles audit trigger
CREATE OR REPLACE FUNCTION audit_user_roles_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM record_audit_log(
            'ROLE_CHANGE'::audit_action,
            'user_roles',
            NEW.user_id,
            NULL,
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM record_audit_log(
            'ROLE_CHANGE'::audit_action,
            'user_roles',
            NEW.user_id,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM record_audit_log(
            'ROLE_CHANGE'::audit_action,
            'user_roles',
            OLD.user_id,
            to_jsonb(OLD),
            NULL
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER user_roles_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_roles_trigger();

COMMENT ON TABLE audit_logs IS 
'Stores detailed audit trail of all important actions in the system.';

COMMENT ON COLUMN audit_logs.action IS 
'Type of action performed (e.g., INSERT, UPDATE, DELETE, LOGIN, etc.).';

COMMENT ON COLUMN audit_logs.old_data IS 
'Previous state of the record for UPDATE/DELETE operations.';

COMMENT ON COLUMN audit_logs.new_data IS 
'New state of the record for INSERT/UPDATE operations.';

COMMENT ON COLUMN audit_logs.additional_info IS 
'Additional context about the action (e.g., reason for change, approval details).'; 