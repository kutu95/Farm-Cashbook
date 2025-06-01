-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Add RLS policies for profiles
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Drop and recreate parties policies
DROP POLICY IF EXISTS "All users can view parties" ON parties;

CREATE POLICY "All users can view parties"
    ON parties FOR SELECT
    TO authenticated
    USING (true);

-- Drop and recreate user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    USING (auth.uid() = user_id); 