-- Re-enable RLS with proper policies for bill_splits
-- Run this in your Supabase SQL Editor

-- 1. Re-enable RLS
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own bill splits" ON bill_splits;
DROP POLICY IF EXISTS "Users can view bill splits for bills in their groups" ON bill_splits;
DROP POLICY IF EXISTS "Users can insert bill splits for bills they created" ON bill_splits;
DROP POLICY IF EXISTS "Bill creators can insert splits for group members" ON bill_splits;
DROP POLICY IF EXISTS "Users can update their own bill splits" ON bill_splits;
DROP POLICY IF EXISTS "Bill creators can update splits for group members" ON bill_splits;
DROP POLICY IF EXISTS "Bill creators can delete bill splits" ON bill_splits;

-- 3. Create comprehensive policies that work

-- SELECT policies
CREATE POLICY "Users can view their own bill splits" ON bill_splits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view bill splits for bills in their groups" ON bill_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN group_members gm ON b.group_id = gm.group_id
      WHERE b.id = bill_splits.bill_id AND gm.user_id = auth.uid()
    )
  );

-- INSERT policy (this was the problematic one)
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

-- UPDATE policies
CREATE POLICY "Users can update their own bill splits" ON bill_splits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Bill creators can update splits for group members" ON bill_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bills b
      WHERE b.id = bill_splits.bill_id AND b.created_by = auth.uid()
    )
  );

-- DELETE policy
CREATE POLICY "Bill creators can delete bill splits" ON bill_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bills b
      WHERE b.id = bill_splits.bill_id AND b.created_by = auth.uid()
    )
  );

-- 4. Verify all policies are created
SELECT 'Final Policies:' as info;
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'bill_splits' 
ORDER BY cmd, policyname;

-- 5. Verify RLS is enabled
SELECT 'RLS Status:' as info;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'bill_splits';