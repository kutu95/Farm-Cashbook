-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

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

-- Enable RLS on parties table
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for parties
CREATE POLICY "All users can view parties"
    ON parties FOR SELECT
    TO authenticated
    USING (true);

-- Add RLS policies for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    USING (auth.uid() = user_id); 