-- Clean and fix RLS policies for bill_splits
-- Run this in your Supabase SQL Editor

-- 1. First, let's see what policies currently exist
SELECT 'Current Policies Before Cleanup:' as info;
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY cmd, policyname;

-- 2. Drop ALL existing policies to start completely fresh
DROP POLICY IF EXISTS "Users can view their own bill splits" ON bill_splits;
DROP POLICY IF EXISTS "Users can view bill splits for bills in their groups" ON bill_splits;
DROP POLICY IF EXISTS "Users can insert bill splits for bills they created" ON bill_splits;
DROP POLICY IF EXISTS "Bill creators can insert splits for group members" ON bill_splits;
DROP POLICY IF EXISTS "Users can update their own bill splits" ON bill_splits;
DROP POLICY IF EXISTS "Bill creators can update splits for group members" ON bill_splits;
DROP POLICY IF EXISTS "Bill creators can delete bill splits" ON bill_splits;

-- 3. Verify all policies are dropped
SELECT 'Policies After Cleanup (should be empty):' as info;
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY cmd, policyname;

-- 4. Re-enable RLS (in case it was disabled)
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;

-- 5. Create fresh, working policies

-- SELECT policies
CREATE POLICY "view_own_splits" ON bill_splits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "view_group_splits" ON bill_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN group_members gm ON b.group_id = gm.group_id
      WHERE b.id = bill_splits.bill_id AND gm.user_id = auth.uid()
    )
  );

-- INSERT policy (the critical one that was failing)
CREATE POLICY "insert_splits_for_group_members" ON bill_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN group_members gm ON b.group_id = gm.group_id
      WHERE b.id = bill_splits.bill_id 
      AND b.created_by = auth.uid()
      AND gm.user_id = bill_splits.user_id
    )
  );

-- UPDATE policies
CREATE POLICY "update_own_splits" ON bill_splits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "creator_update_splits" ON bill_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bills b
      WHERE b.id = bill_splits.bill_id AND b.created_by = auth.uid()
    )
  );

-- DELETE policy
CREATE POLICY "creator_delete_splits" ON bill_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bills b
      WHERE b.id = bill_splits.bill_id AND b.created_by = auth.uid()
    )
  );

-- 6. Verify final policies
SELECT 'Final Policies:' as info;
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY cmd, policyname;

-- 7. Verify RLS is enabled
SELECT 'RLS Status:' as info;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'bill_splits';