-- Clean fix for bill_splits RLS policies
-- Run this in your Supabase SQL Editor

-- First, let's see what policies currently exist
SELECT 'Current policies:' as info;
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY policyname;

-- Drop ALL existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert bill splits for bills they created" ON bill_splits;
DROP POLICY IF EXISTS "Bill creators can insert splits for group members" ON bill_splits;

-- Create the correct INSERT policy
CREATE POLICY "Bill creators can insert splits for group members" ON bill_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN group_members gm ON b.group_id = gm.group_id
      WHERE b.id = bill_splits.bill_id 
      AND b.created_by = auth.uid()
      AND gm.user_id = bill_splits.user_id
    )
  );

-- Verify the final policies
SELECT 'Final policies:' as info;
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY policyname;