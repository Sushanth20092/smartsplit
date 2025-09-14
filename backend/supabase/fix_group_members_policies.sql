-- Fix infinite recursion in group_members policies
-- Run this in your Supabase SQL editor

-- Drop the problematic policies
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;

-- Create separate, non-recursive policies
CREATE POLICY "Users can insert themselves as group members" ON group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Group admins can insert new members" ON group_members
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Group admins can update members" ON group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Group admins can delete members" ON group_members
  FOR DELETE USING (
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
