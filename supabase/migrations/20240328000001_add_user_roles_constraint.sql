-- Start transaction
BEGIN;

-- Double check no orphaned records exist
DO $$
DECLARE
    orphan_count integer;
    first_orphan uuid;
BEGIN
    SELECT COUNT(*), MIN(ur.user_id)
    INTO orphan_count, first_orphan
    FROM user_roles ur
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.id = ur.user_id
    );

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Cannot add constraint - found % orphaned records. First orphan: %', 
            orphan_count, first_orphan;
    END IF;
END $$;

-- Add the foreign key constraint
ALTER TABLE user_roles
    DROP CONSTRAINT IF EXISTS fk_user_roles_user;

ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Add an index to improve join performance
DROP INDEX IF EXISTS idx_user_roles_user_id;
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

COMMENT ON CONSTRAINT fk_user_roles_user ON user_roles IS 
'Ensures user_roles entries can only reference existing users and are automatically removed when the user is deleted';

-- If we got here, commit the transaction
COMMIT; 