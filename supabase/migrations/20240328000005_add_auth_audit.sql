-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS auth_login_audit_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_event();

-- Create function to handle auth events
CREATE OR REPLACE FUNCTION public.handle_auth_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only log if last_sign_in_at changed and is not null
    IF NEW.last_sign_in_at IS NOT NULL AND 
       (OLD.last_sign_in_at IS NULL OR NEW.last_sign_in_at != OLD.last_sign_in_at) THEN
        
        INSERT INTO public.audit_logs (
            user_id,
            action,
            table_name,
            additional_info
        ) VALUES (
            NEW.id,
            'LOGIN'::audit_action,
            'auth.users',
            jsonb_build_object('user_email', NEW.email)
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Always return NEW even if logging fails
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER auth_login_audit_trigger
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_event();

-- Grant necessary permissions
GRANT TRIGGER ON auth.users TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_auth_event TO postgres; 