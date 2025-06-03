-- Drop all existing user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
DROP POLICY IF EXISTS "Anyone can view roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can modify roles" ON user_roles;

-- Create simple policies for user_roles
CREATE POLICY "Enable read access for all users"
    ON user_roles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users"
    ON user_roles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own role"
    ON user_roles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for own role"
    ON user_roles FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id); 