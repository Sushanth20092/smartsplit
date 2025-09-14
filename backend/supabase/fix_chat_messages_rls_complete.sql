-- Complete fix for chat_messages RLS policies
-- Run this in your Supabase SQL Editor

-- First, drop any existing policies to start fresh
DROP POLICY IF EXISTS "Group members can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Group members can send chat messages" ON chat_messages;

-- Verify RLS is enabled
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create a simple policy for SELECT (viewing messages)
CREATE POLICY "Users can view messages in their groups" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = chat_messages.group_id 
      AND gm.user_id = auth.uid()
    )
  );

-- Create a simple policy for INSERT (sending messages)
CREATE POLICY "Users can send messages to their groups" ON chat_messages
  FOR INSERT WITH CHECK (
    -- User must be a member of the group
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = chat_messages.group_id 
      AND gm.user_id = auth.uid()
    )
    -- And the user_id in the message must match the authenticated user
    AND user_id = auth.uid()
  );

-- Grant necessary permissions
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON chat_messages TO service_role;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'chat_messages'
ORDER BY policyname;
