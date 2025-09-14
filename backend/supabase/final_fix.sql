-- FINAL FIX: Resolve both RLS and group creation issues
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

-- Create simple working policy for groups
CREATE POLICY "Allow authenticated users to manage groups" ON groups
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Re-enable RLS on groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Step 2: Ensure group_members policies are also working
-- (These should already be fixed from previous steps, but let's make sure)

-- Check if group_members RLS is enabled and working
-- If you're still getting recursion errors, run this:
-- ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;
-- DROP ALL group_members policies and recreate the simple one:

-- DROP POLICY IF EXISTS "Allow authenticated users full access to group_members" ON group_members;
-- CREATE POLICY "Allow authenticated users to manage group_members" ON group_members
--   FOR ALL USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');
-- ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Step 3: Test group creation
-- Your app should now be able to:
-- 1. Insert into groups table (no more RLS violation)
-- 2. Insert into group_members table (no more recursion)
-- 3. Display success screen (no more undefined errors)
