-- Fix RLS policies to allow bill status updates
-- Run this in your Supabase SQL Editor

-- First, check current policies (for reference)
-- SELECT * FROM pg_policies WHERE tablename = 'bills';

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update bills they created or are part of" ON public.bills;
DROP POLICY IF EXISTS "Users can update their bills" ON public.bills;
DROP POLICY IF EXISTS "Bill updates allowed" ON public.bills;

-- Create a comprehensive update policy for bills
CREATE POLICY "Users can update bills they participate in" ON public.bills
FOR UPDATE
TO authenticated
USING (
  -- User is the creator of the bill
  auth.uid() = created_by
  OR
  -- User is a participant in the bill (has a bill_split)
  EXISTS (
    SELECT 1 FROM public.bill_splits 
    WHERE bill_splits.bill_id = bills.id 
    AND bill_splits.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same conditions for the updated data
  auth.uid() = created_by
  OR
  EXISTS (
    SELECT 1 FROM public.bill_splits 
    WHERE bill_splits.bill_id = bills.id 
    AND bill_splits.user_id = auth.uid()
  )
);

-- Also ensure there's a proper select policy
DROP POLICY IF EXISTS "Users can view bills they participate in" ON public.bills;

CREATE POLICY "Users can view bills they participate in" ON public.bills
FOR SELECT
TO authenticated
USING (
  -- User is the creator of the bill
  auth.uid() = created_by
  OR
  -- User is a participant in the bill
  EXISTS (
    SELECT 1 FROM public.bill_splits 
    WHERE bill_splits.bill_id = bills.id 
    AND bill_splits.user_id = auth.uid()
  )
  OR
  -- User is a member of the group the bill belongs to
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_members.group_id = bills.group_id 
    AND group_members.user_id = auth.uid()
  )
);

-- Verify RLS is enabled on bills table
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Check the policies were created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'bills';