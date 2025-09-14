-- Fix users table RLS policy to allow group members to see each other
-- Run this in your Supabase SQL Editor

-- Add policy to allow users to view profiles of other users in their groups
CREATE POLICY "Users can view group members profiles" ON users
  FOR SELECT USING (
    id IN (
      SELECT gm.user_id 
      FROM group_members gm
      WHERE gm.group_id IN (
        SELECT group_id 
        FROM group_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Verify the policy was created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'users';
