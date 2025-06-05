-- Add timestamps to user_roles
ALTER TABLE user_roles 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Add check constraint for valid roles
ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_valid_role CHECK (role IN ('admin', 'user'));

-- Add index for role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Add composite index for user lookup with role
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON user_roles(user_id, role);

-- Add helpful comments
COMMENT ON TABLE user_roles IS 
'Stores user role assignments. Links users from auth.users to their application roles.';

COMMENT ON COLUMN user_roles.user_id IS 
'References auth.users(id). When a user is deleted, their role record is automatically removed via ON DELETE CASCADE.';

COMMENT ON COLUMN user_roles.role IS 
'The role assigned to the user. Valid values are: admin, user.';

COMMENT ON COLUMN user_roles.created_at IS 
'Timestamp when the role was assigned to the user.';

COMMENT ON COLUMN user_roles.updated_at IS 
'Timestamp when the role assignment was last updated.'; 