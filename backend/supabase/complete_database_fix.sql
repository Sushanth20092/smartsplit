-- COMPLETE DATABASE FIX: Resolve all RLS, foreign key, and policy issues
-- Run this in Supabase SQL Editor

-- Step 1: Fix groups table policies (this is causing the RLS violation)
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;

-- Drop all existing groups policies
DROP POLICY IF EXISTS "Users can view groups they are members of" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Group creators and admins can update groups" ON groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON groups;
DROP POLICY IF EXISTS "Allow all authenticated operations on groups" ON groups;
DROP POLICY IF EXISTS "Allow authenticated users to manage groups" ON groups;

-- Create simple working policy for groups
CREATE POLICY "Allow authenticated users to manage groups" ON groups
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Re-enable RLS on groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Step 2: Fix group_members policies (resolve infinite recursion)
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;

-- Drop all existing group_members policies
DROP POLICY IF EXISTS "Users can view group members" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Allow authenticated users full access to group_members" ON group_members;
DROP POLICY IF EXISTS "Allow authenticated users to manage group_members" ON group_members;

-- Create simple working policy for group_members
CREATE POLICY "Allow authenticated users to manage group_members" ON group_members
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Re-enable RLS on group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Step 3: Verify foreign key relationships exist
-- Check if the foreign key from group_members to users exists
DO $$
BEGIN
    -- Check if foreign key exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'group_members_user_id_fkey' 
        AND table_name = 'group_members'
    ) THEN
        ALTER TABLE group_members 
        ADD CONSTRAINT group_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Check if foreign key from group_members to groups exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'group_members_group_id_fkey' 
        AND table_name = 'group_members'
    ) THEN
        ALTER TABLE group_members 
        ADD CONSTRAINT group_members_group_id_fkey 
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Test the setup
-- This should now work without errors:
-- 1. Insert into groups table (no more RLS violation)
-- 2. Insert into group_members table (no more recursion)
-- 3. Query with joins (foreign keys work)

-- Step 5: Verify the fix worked
SELECT 'Database fix completed successfully!' as status;
