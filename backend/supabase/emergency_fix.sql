-- EMERGENCY FIX: Temporarily disable RLS on group_members to stop recursion
-- Run this immediately in Supabase SQL Editor

-- Step 1: Disable RLS temporarily to stop the infinite recursion
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies (this will work now that RLS is disabled)
DROP POLICY IF EXISTS "Users can view group members of their groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;
DROP POLICY IF EXISTS "Users can insert themselves as group members" ON group_members;
DROP POLICY IF EXISTS "Group admins can insert new members" ON group_members;
DROP POLICY IF EXISTS "Group admins can update members" ON group_members;
DROP POLICY IF EXISTS "Group admins can delete members" ON group_members;
DROP POLICY IF EXISTS "Users can view group members" ON group_members;
DROP POLICY IF EXISTS "Group creators can add themselves as admin" ON group_members;
DROP POLICY IF EXISTS "Admins can add new members" ON group_members;
DROP POLICY IF EXISTS "Admins can update members" ON group_members;
DROP POLICY IF EXISTS "Admins can remove members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- Step 3: Create simple, working policies
CREATE POLICY "Allow authenticated users full access to group_members" ON group_members
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Step 4: Re-enable RLS with the simple policy
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
