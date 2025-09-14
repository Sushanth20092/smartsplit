-- Debug and fix groups table RLS issue
-- Run this step by step in Supabase SQL Editor

-- Step 1: Check current user context (run this first to see what we get)
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role,
  current_user as db_user;

-- Step 2: Check existing policies on groups table
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'groups';

-- Step 3: Temporarily disable RLS on groups to allow group creation
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;

-- Step 4: Test if group creation works now (try creating a group in your app)
-- If it works, then we know it's definitely a policy issue

-- Step 5: Re-enable RLS with a very permissive policy for testing
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view groups they are members of" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Group creators and admins can update groups" ON groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON groups;

-- Create a very simple policy for testing
CREATE POLICY "Allow all authenticated operations on groups" ON groups
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Step 6: Test group creation again
-- If this works, we can then create more specific policies
