-- Add missing UPDATE policy for bills table
-- Run this in your Supabase SQL Editor

-- Create UPDATE policy for bills table to allow bill creators to update their bills
CREATE POLICY "Bill creators can update their bills" ON bills
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Verify the policy was created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'bills' AND policyname = 'Bill creators can update their bills';
