-- Debug script to check group membership and RLS setup
-- Run this in your Supabase SQL Editor to debug the issue

-- Check if the user is authenticated
SELECT auth.uid() as current_user_id;

-- Check group membership for the current user
-- Replace 'YOUR_GROUP_ID_HERE' with the actual group ID you're testing with
SELECT 
    gm.id,
    gm.group_id,
    gm.user_id,
    gm.role,
    u.name as user_name,
    g.name as group_name
FROM group_members gm
JOIN users u ON gm.user_id = u.id
JOIN groups g ON gm.group_id = g.id
WHERE gm.user_id = auth.uid();

-- Check if RLS is enabled on chat_messages
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'chat_messages';

-- Check existing policies on chat_messages
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual
FROM pg_policies 
WHERE tablename = 'chat_messages';

-- Test if we can see any chat_messages (this should work if SELECT policy is correct)
SELECT COUNT(*) as message_count FROM chat_messages;

-- Test group membership check for a specific group
-- Replace 'YOUR_GROUP_ID_HERE' with the actual group ID
/*
SELECT EXISTS (
  SELECT 1 FROM group_members gm
  WHERE gm.group_id = 'YOUR_GROUP_ID_HERE'
  AND gm.user_id = auth.uid()
) as is_member;
*/
