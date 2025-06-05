-- Ensure we have proper indexes
DROP INDEX IF EXISTS idx_user_roles_user_id;
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- Ensure we have proper constraints
ALTER TABLE user_roles
    DROP CONSTRAINT IF EXISTS fk_user_roles_user;

ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add helpful comments
COMMENT ON TABLE user_roles IS 
'Stores user role assignments. Each record links a user to their role.';

COMMENT ON COLUMN user_roles.user_id IS 
'References auth.users(id). When a user is deleted, their role record is automatically removed.';

COMMENT ON COLUMN user_roles.role IS 
'The role assigned to the user (e.g., "admin", "user").'; 