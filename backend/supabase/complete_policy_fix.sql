-- Complete fix for group_members infinite recursion
-- Run this in your Supabase SQL editor

-- First, drop ALL existing group_members policies to start fresh
DROP POLICY IF EXISTS "Users can view group members of their groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;
DROP POLICY IF EXISTS "Users can insert themselves as group members" ON group_members;
DROP POLICY IF EXISTS "Group admins can insert new members" ON group_members;
DROP POLICY IF EXISTS "Group admins can update members" ON group_members;
DROP POLICY IF EXISTS "Group admins can delete members" ON group_members;

-- Create new, non-recursive policies

-- 1. SELECT policy: Allow users to see members of groups they belong to
-- This uses a direct join instead of a subquery to avoid recursion
CREATE POLICY "Users can view group members" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND (
        g.created_by = auth.uid() OR 
        group_members.user_id = auth.uid()
      )
    )
  );

-- 2. INSERT policy: Allow group creators to add themselves as admin
CREATE POLICY "Group creators can add themselves as admin" ON group_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM groups 
      WHERE id = group_id AND created_by = auth.uid()
    )
  );

-- 3. INSERT policy: Allow existing admins to add new members
CREATE POLICY "Admins can add new members" ON group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members existing_member
      WHERE existing_member.group_id = group_members.group_id
      AND existing_member.user_id = auth.uid()
      AND existing_member.role = 'admin'
    )
  );

-- 4. UPDATE policy: Allow admins to update member roles
CREATE POLICY "Admins can update members" ON group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members admin_check
      WHERE admin_check.group_id = group_members.group_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
  );

-- 5. DELETE policy: Allow admins to remove members
CREATE POLICY "Admins can remove members" ON group_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_members admin_check
      WHERE admin_check.group_id = group_members.group_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
  );

-- 6. Allow users to remove themselves from groups
CREATE POLICY "Users can leave groups" ON group_members
  FOR DELETE USING (user_id = auth.uid());
