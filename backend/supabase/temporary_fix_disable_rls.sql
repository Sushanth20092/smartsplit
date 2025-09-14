-- TEMPORARY FIX: Disable RLS on bill_splits table
-- This is a temporary solution to get your app working while we debug
-- Run this in your Supabase SQL Editor

-- Disable RLS temporarily
ALTER TABLE bill_splits DISABLE ROW LEVEL SECURITY;

-- Check if it's disabled
SELECT 'RLS Status After Disable:' as info;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'bill_splits';

-- NOTE: This makes the table accessible to all authenticated users
-- We'll re-enable it with proper policies once we identify the issue