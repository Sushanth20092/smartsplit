-- Add approval status tracking to bill_splits table
-- This allows tracking individual participant approval/rejection status

-- Add approval_status column to bill_splits
ALTER TABLE public.bill_splits 
ADD COLUMN approval_status text DEFAULT 'pending' 
CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

-- Add approval timestamp
ALTER TABLE public.bill_splits 
ADD COLUMN approval_at timestamp with time zone;

-- Update bills table to include 'approved' status
ALTER TABLE public.bills 
DROP CONSTRAINT IF EXISTS bills_status_check;

ALTER TABLE public.bills 
ADD CONSTRAINT bills_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'settled'::text, 'cancelled'::text]));

-- Add split_method to bills table to track how the bill was split
ALTER TABLE public.bills 
ADD COLUMN split_method text DEFAULT 'equal' 
CHECK (split_method = ANY (ARRAY['equal'::text, 'by_item'::text, 'custom'::text]));

-- Create index for faster approval status queries
CREATE INDEX IF NOT EXISTS idx_bill_splits_approval_status ON public.bill_splits(approval_status);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);

-- Update existing bill_splits to have pending approval status
UPDATE public.bill_splits 
SET approval_status = 'pending' 
WHERE approval_status IS NULL;

COMMENT ON COLUMN public.bill_splits.approval_status IS 'Approval status of the participant for this bill split';
COMMENT ON COLUMN public.bill_splits.approval_at IS 'Timestamp when the participant approved/rejected the split';
COMMENT ON COLUMN public.bills.split_method IS 'Method used to split the bill: equal, by_item, or custom';