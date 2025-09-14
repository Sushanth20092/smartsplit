-- URGENT: Fix infinite recursion in RLS policies
-- Run this in your Supabase SQL Editor immediately

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can update bills they participate in" ON public.bills;
DROP POLICY IF EXISTS "Users can view bills they participate in" ON public.bills;

-- Create simple, non-recursive policies

-- Allow users to view bills in groups they're members of
CREATE POLICY "Users can view group bills" ON public.bills
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_members.group_id = bills.group_id 
    AND group_members.user_id = auth.uid()
  )
);

-- Allow users to update bills in groups they're members of
CREATE POLICY "Users can update group bills" ON public.bills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_members.group_id = bills.group_id 
    AND group_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_members.group_id = bills.group_id 
    AND group_members.user_id = auth.uid()
  )
);

-- Allow users to insert bills in groups they're members of
CREATE POLICY "Users can create group bills" ON public.bills
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_members.group_id = bills.group_id 
    AND group_members.user_id = auth.uid()
  )
);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'bills';