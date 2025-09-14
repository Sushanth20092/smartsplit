-- Fix bill_splits RLS policy to allow bill creators to insert splits for all group members
-- Run this in your Supabase SQL Editor

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert bill splits for bills they created" ON bill_splits;

-- Create a new policy that allows bill creators to insert splits for any group member
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

-- Verify the policy was created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'bill_splits' AND policyname = 'Bill creators can insert splits for group members';
