-- Complete fix for bill_splits RLS policies
-- Run this in your Supabase SQL Editor

-- Drop existing INSERT policy that's too restrictive
DROP POLICY IF EXISTS "Users can insert bill splits for bills they created" ON bill_splits;

-- Create a new INSERT policy that allows bill creators to insert splits for any group member
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

-- Also ensure bill creators can update splits for group members (needed for marking as paid)
DROP POLICY IF EXISTS "Users can update their own bill splits" ON bill_splits;

CREATE POLICY "Users can update their own bill splits" ON bill_splits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Bill creators can update splits for group members" ON bill_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN group_members gm ON b.group_id = gm.group_id
      WHERE b.id = bill_splits.bill_id 
      AND b.created_by = auth.uid()
      AND gm.user_id = bill_splits.user_id
    )
  );

-- Verify the policies were created correctly
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY policyname;