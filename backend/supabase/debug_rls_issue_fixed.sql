-- Debug RLS issue for bill_splits (Fixed version)
-- Run this in your Supabase SQL Editor

-- 1. Check if RLS is enabled
SELECT 'RLS Status:' as info;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'bill_splits';

-- 2. Check all current policies
SELECT 'Current Policies:' as info;
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY cmd, policyname;

-- 3. Check if the user is properly authenticated
SELECT 'Current User:' as info;
SELECT auth.uid() as current_user_id;

-- 4. Test the specific bill and group membership
-- Replace these UUIDs with actual values from your error log:
-- bill_id: "6b65e6cf-9dba-465f-aa31-e6bf072cd5c7"
-- user_ids: "0a3a301d-2497-4606-bd6f-b6c43a4d263e", "2fcd6ab9-dfa9-42ba-9976-d148731bed6b"

SELECT 'Bill Info:' as info;
SELECT b.id, b.title, b.created_by, b.group_id, g.name as group_name
FROM bills b
JOIN groups g ON b.group_id = g.id
WHERE b.id = '6b65e6cf-9dba-465f-aa31-e6bf072cd5c7';

SELECT 'Group Members:' as info;
SELECT gm.user_id, u.name, u.email
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = (
  SELECT group_id FROM bills WHERE id = '6b65e6cf-9dba-465f-aa31-e6bf072cd5c7'
);

-- 5. Test if the policy condition would pass
SELECT 'Policy Test:' as info;
SELECT 
  '0a3a301d-2497-4606-bd6f-b6c43a4d263e' as test_user_id,
  EXISTS (
    SELECT 1 FROM bills b
    JOIN group_members gm ON b.group_id = gm.group_id
    WHERE b.id = '6b65e6cf-9dba-465f-aa31-e6bf072cd5c7'
    AND b.created_by = auth.uid()
    AND gm.user_id = '0a3a301d-2497-4606-bd6f-b6c43a4d263e'
  ) as policy_would_pass_user1,
  EXISTS (
    SELECT 1 FROM bills b
    JOIN group_members gm ON b.group_id = gm.group_id
    WHERE b.id = '6b65e6cf-9dba-465f-aa31-e6bf072cd5c7'
    AND b.created_by = auth.uid()
    AND gm.user_id = '2fcd6ab9-dfa9-42ba-9976-d148731bed6b'
  ) as policy_would_pass_user2;