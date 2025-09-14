-- Fix groups table policies to work with the new group_members policies
-- Run this in Supabase SQL Editor

-- Drop existing groups policies
DROP POLICY IF EXISTS "Users can view groups they are members of" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;

-- Create new working policies for groups table

-- 1. Allow users to create groups (this should work for group creation)
CREATE POLICY "Authenticated users can create groups" ON groups
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    auth.uid() = created_by
  );

-- 2. Allow users to view groups they created or are members of
CREATE POLICY "Users can view their groups" ON groups
  FOR SELECT USING (
    auth.uid() = created_by OR
    id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 3. Allow group creators and admins to update groups
CREATE POLICY "Group creators and admins can update groups" ON groups
  FOR UPDATE USING (
    auth.uid() = created_by OR
    id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Allow group creators to delete groups
CREATE POLICY "Group creators can delete groups" ON groups
  FOR DELETE USING (auth.uid() = created_by);
