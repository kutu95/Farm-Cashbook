-- Create a function to clean up orphaned records with elevated privileges
CREATE OR REPLACE FUNCTION clean_orphaned_user_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count int;
    v_record record;
BEGIN
    -- Show all records in user_roles
    RAISE NOTICE 'All user_roles records:';
    FOR v_record IN
        SELECT 
            ur.user_id::text as user_id,
            COALESCE(ur.role, 'NULL') as role,
            CASE 
                WHEN EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ur.user_id) THEN 'Yes'
                ELSE 'No'
            END as has_user
        FROM public.user_roles ur
    LOOP
        RAISE NOTICE 'Role record - user_id: %, role: %, has matching user: %', 
            v_record.user_id, 
            v_record.role,
            v_record.has_user;
    END LOOP;

    -- Show problematic records
    RAISE NOTICE E'\nProblematic user_roles records:';
    FOR v_record IN
        SELECT 
            ur.user_id::text as user_id,
            COALESCE(ur.role, 'NULL') as role
        FROM public.user_roles ur
        WHERE NOT EXISTS (
            SELECT 1
            FROM auth.users au
            WHERE au.id = ur.user_id
        )
    LOOP
        RAISE NOTICE 'Orphaned role record - user_id: %, role: %', 
            v_record.user_id, 
            v_record.role;
    END LOOP;

    -- Delete orphaned records
    WITH deleted AS (
        DELETE FROM public.user_roles ur
        WHERE NOT EXISTS (
            SELECT 1
            FROM auth.users au
            WHERE au.id = ur.user_id
        )
        RETURNING *
    )
    SELECT COUNT(*) INTO v_count FROM deleted;

    RAISE NOTICE E'\nDeleted % orphaned user_role records', v_count;

    -- Verify remaining records
    RAISE NOTICE E'\nRemaining user_roles records:';
    FOR v_record IN
        SELECT 
            ur.user_id::text as user_id,
            COALESCE(ur.role, 'NULL') as role
        FROM public.user_roles ur
    LOOP
        RAISE NOTICE 'Remaining role record - user_id: %, role: %', 
            v_record.user_id, 
            v_record.role;
    END LOOP;
END;
$$;

-- Execute the cleanup function
SELECT clean_orphaned_user_roles();

-- Drop the function after use
DROP FUNCTION clean_orphaned_user_roles();

-- Now add the foreign key constraint
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

-- Show current data
SELECT 'User Roles Table Contents:' as message;
SELECT user_id::text, role FROM user_roles;

SELECT E'\nAuth Users Table Contents:' as message;
SELECT id::text, email FROM auth.users;

DO $$
DECLARE
    r record;
    orphan_count integer;
BEGIN
    -- Start transaction
    RAISE NOTICE 'Starting cleanup process...';
    
    -- Show all records in user_roles
    RAISE NOTICE E'\nAll records in user_roles:';
    FOR r IN (SELECT user_id::text, role FROM user_roles ORDER BY role, user_id) LOOP
        RAISE NOTICE 'user_id: %, role: %', r.user_id, r.role;
    END LOOP;

    -- Show all records in auth.users
    RAISE NOTICE E'\nAll records in auth.users:';
    FOR r IN (SELECT id::text, email FROM auth.users ORDER BY email) LOOP
        RAISE NOTICE 'id: %, email: %', r.id, r.email;
    END LOOP;

    -- Create temp table for orphaned records
    CREATE TEMP TABLE orphaned_records AS
    SELECT ur.user_id, ur.role
    FROM user_roles ur
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.id = ur.user_id
    );

    -- Show orphaned records
    RAISE NOTICE E'\nOrphaned records to be deleted:';
    FOR r IN (SELECT user_id::text, role FROM orphaned_records ORDER BY role, user_id) LOOP
        RAISE NOTICE 'user_id: %, role: %', r.user_id, r.role;
    END LOOP;

    -- Delete orphaned records
    DELETE FROM user_roles ur
    WHERE EXISTS (
        SELECT 1 FROM orphaned_records o WHERE o.user_id = ur.user_id
    );
    GET DIAGNOSTICS orphan_count = ROW_COUNT;
    RAISE NOTICE E'\nDeleted % orphaned records', orphan_count;

    -- Show remaining records
    RAISE NOTICE E'\nRemaining records after cleanup:';
    FOR r IN (SELECT user_id::text, role FROM user_roles ORDER BY role, user_id) LOOP
        RAISE NOTICE 'user_id: %, role: %', r.user_id, r.role;
    END LOOP;

    -- Drop temp table
    DROP TABLE orphaned_records;

    -- Final verification
    SELECT COUNT(*)
    INTO orphan_count
    FROM user_roles ur
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.id = ur.user_id
    );

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Found % orphaned records after cleanup', orphan_count;
    END IF;

    RAISE NOTICE E'\nCleanup completed successfully!';
END $$;

-- Count total records
SELECT COUNT(*) as total_records FROM user_roles;

-- Show all records with explicit column names
SELECT 
    user_id::text as user_id,
    role as role_name,
    'Row End' as end_marker
FROM user_roles;

-- Step 1: Create a temp table of valid users
CREATE TEMP TABLE valid_users AS
SELECT id FROM auth.users;

-- Step 2: Show orphaned records
SELECT 
    ur.user_id::text,
    ur.role,
    CASE WHEN vu.id IS NULL THEN 'No matching user' ELSE 'Has matching user' END as status
FROM user_roles ur
LEFT JOIN valid_users vu ON ur.user_id = vu.id
ORDER BY ur.role, ur.user_id;

-- Step 3: Delete orphaned records
DELETE FROM user_roles ur
WHERE NOT EXISTS (
    SELECT 1 FROM valid_users vu WHERE vu.id = ur.user_id
);

-- Step 4: Verify remaining records
SELECT 
    ur.user_id::text,
    ur.role,
    'Valid user confirmed' as status
FROM user_roles ur
JOIN valid_users vu ON ur.user_id = vu.id
ORDER BY ur.role, ur.user_id;

-- Cleanup
DROP TABLE valid_users;

-- Create function with elevated privileges
CREATE OR REPLACE FUNCTION cleanup_user_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    r record;
    orphan_count integer;
BEGIN
    -- Show all records in user_roles
    RAISE NOTICE E'\nAll records in public.user_roles:';
    FOR r IN (SELECT user_id::text, role FROM public.user_roles ORDER BY role, user_id) LOOP
        RAISE NOTICE 'user_id: %, role: %', r.user_id, r.role;
    END LOOP;

    -- Show all records in auth.users
    RAISE NOTICE E'\nAll records in auth.users:';
    FOR r IN (SELECT id::text, email FROM auth.users ORDER BY email) LOOP
        RAISE NOTICE 'id: %, email: %', r.id, r.email;
    END LOOP;

    -- Show orphaned records
    RAISE NOTICE E'\nOrphaned records to be deleted:';
    FOR r IN (
        SELECT ur.user_id::text, ur.role 
        FROM public.user_roles ur 
        LEFT JOIN auth.users au ON au.id = ur.user_id 
        WHERE au.id IS NULL
        ORDER BY ur.role, ur.user_id
    ) LOOP
        RAISE NOTICE 'user_id: %, role: %', r.user_id, r.role;
    END LOOP;

    -- Delete orphaned records using LEFT JOIN
    WITH deleted AS (
        DELETE FROM public.user_roles ur
        USING (
            SELECT ur2.user_id
            FROM public.user_roles ur2
            LEFT JOIN auth.users au ON au.id = ur2.user_id
            WHERE au.id IS NULL
        ) as orphaned
        WHERE ur.user_id = orphaned.user_id
        RETURNING ur.*
    )
    SELECT COUNT(*) INTO orphan_count FROM deleted;
    
    RAISE NOTICE E'\nDeleted % orphaned records', orphan_count;

    -- Show remaining records
    RAISE NOTICE E'\nRemaining records after cleanup:';
    FOR r IN (SELECT user_id::text, role FROM public.user_roles ORDER BY role, user_id) LOOP
        RAISE NOTICE 'user_id: %, role: %', r.user_id, r.role;
    END LOOP;

    -- Final verification
    SELECT COUNT(*)
    INTO orphan_count
    FROM public.user_roles ur
    LEFT JOIN auth.users au ON au.id = ur.user_id
    WHERE au.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Found % orphaned records after cleanup', orphan_count;
    END IF;

    RAISE NOTICE E'\nCleanup completed successfully!';
END;
$$;

-- Execute the function
SELECT cleanup_user_roles();

-- Drop the function
DROP FUNCTION cleanup_user_roles();

-- Show detailed comparison of records
WITH user_role_status AS (
    SELECT 
        ur.user_id,
        ur.role,
        au.id as auth_user_id,
        au.email,
        CASE 
            WHEN au.id IS NULL THEN 'ORPHANED'
            ELSE 'VALID'
        END as status
    FROM public.user_roles ur
    LEFT JOIN auth.users au ON au.id = ur.user_id
)
SELECT 
    user_id::text,
    role,
    COALESCE(email, 'NO MATCHING USER') as email,
    status
FROM user_role_status
ORDER BY status DESC, role, user_id;

BEGIN;

-- Create a temp table to store orphaned IDs
CREATE TEMP TABLE orphaned_ids AS
SELECT ur.user_id
FROM public.user_roles ur
LEFT JOIN auth.users au ON au.id = ur.user_id
WHERE au.id IS NULL;

-- Show what we're about to delete
SELECT ur.user_id::text, ur.role
FROM public.user_roles ur
JOIN orphaned_ids o ON o.user_id = ur.user_id;

-- Delete the orphaned records
DELETE FROM public.user_roles ur
USING orphaned_ids o
WHERE ur.user_id = o.user_id;

-- Drop the temp table
DROP TABLE orphaned_ids;

-- Verify no orphans remain
DO $$
DECLARE
    orphan_count integer;
BEGIN
    SELECT COUNT(*)
    INTO orphan_count
    FROM public.user_roles ur
    LEFT JOIN auth.users au ON au.id = ur.user_id
    WHERE au.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Still found % orphaned records', orphan_count;
    END IF;
END $$;

COMMIT; 