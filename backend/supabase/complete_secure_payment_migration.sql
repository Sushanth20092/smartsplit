-- Complete migration for secure payment system
-- Run this in your Supabase SQL Editor

-- 1. Update notifications table constraint to include new notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'bill_added'::text,
  'bill_pending_approval'::text,
  'payment_request'::text, 
  'payment_received'::text,
  'payment_submitted'::text,
  'payment_confirmed'::text,
  'payment_rejected'::text,
  'group_invite'::text,
  'user_joined_group'::text,
  'user_left_group'::text,
  'bill_settled'::text
]));

-- 2. Add payment_status column to bill_splits table
ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'::text 
CHECK (payment_status = ANY (ARRAY['pending'::text, 'submitted'::text, 'confirmed'::text, 'rejected'::text]));

-- 3. Add rejection_reason column for when payments are rejected
ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 4. Add UPI reference and screenshot columns if they don't exist
ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS upi_reference text;

ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS upi_screenshot_url text;

-- 5. Add approval status columns if they don't exist (for bill approval workflow)
ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending'::text 
CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS approval_at timestamp with time zone;

-- 6. Update bills table to include missing status values and fields
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE public.bills ADD CONSTRAINT bills_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'settled'::text, 'cancelled'::text]));

-- Add missing fields to bills table
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS tip_amount decimal(10,2) DEFAULT 0;

ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS tax_amount decimal(10,2) DEFAULT 0;

ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS split_method text DEFAULT 'equal'::text 
CHECK (split_method = ANY (ARRAY['equal'::text, 'by_item'::text, 'custom'::text]));

ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS settled_at timestamp with time zone;

-- 7. Add assigned_users column to bill_items if it doesn't exist
ALTER TABLE public.bill_items 
ADD COLUMN IF NOT EXISTS assigned_users text[];

-- 8. Update existing records to have 'confirmed' payment status if they are already paid
UPDATE public.bill_splits 
SET payment_status = 'confirmed' 
WHERE paid = true AND payment_status = 'pending';

-- 9. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bill_splits_payment_status ON public.bill_splits(payment_status);
CREATE INDEX IF NOT EXISTS idx_bill_splits_bill_id_payment_status ON public.bill_splits(bill_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_bill_splits_approval_status ON public.bill_splits(approval_status);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);

-- 10. Add comments for documentation
COMMENT ON COLUMN public.bill_splits.payment_status IS 'Payment verification status: pending (no proof), submitted (proof uploaded), confirmed (verified by creator), rejected (proof rejected)';
COMMENT ON COLUMN public.bill_splits.rejection_reason IS 'Reason provided by creator when rejecting payment proof';
COMMENT ON COLUMN public.bill_splits.approval_status IS 'Bill split approval status for the approval workflow';
COMMENT ON COLUMN public.bills.split_method IS 'Method used to split the bill: equal, by_item, or custom';

-- Verify the changes
SELECT 'Notifications constraint updated' as status;
SELECT 'Bill splits table updated with payment_status' as status;
SELECT 'Bills table updated with new fields' as status;