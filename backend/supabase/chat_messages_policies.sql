-- Create RLS policies for chat_messages table
-- Run this in your Supabase SQL Editor

-- Allow group members to view chat messages for groups they belong to
CREATE POLICY "Group members can view chat messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = chat_messages.group_id 
      AND gm.user_id = auth.uid()
    )
  );

-- Allow group members to insert chat messages for groups they belong to
CREATE POLICY "Group members can send chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = chat_messages.group_id 
      AND gm.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'chat_messages';
