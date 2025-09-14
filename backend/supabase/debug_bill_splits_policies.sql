-- Debug: Check all current policies on bill_splits table
-- Run this in your Supabase SQL Editor to see what policies exist

SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY policyname;

-- Also check if RLS is enabled
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables 
WHERE tablename = 'bill_splits';