-- Drop the old trigger and function
DROP TRIGGER IF EXISTS auth_login_audit_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_event(); 