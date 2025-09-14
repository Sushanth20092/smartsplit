-- Add approved_at and settled_at timestamp fields to bills table
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS settled_at timestamp with time zone;

-- Add UPI reference and screenshot fields to bill_splits if they don't exist
-- (These seem to already exist in the schema but adding for completeness)
ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS upi_reference text,
ADD COLUMN IF NOT EXISTS upi_screenshot_url text;

-- Update notification types to include bill_settled
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'bill_added'::text, 
  'bill_pending_approval'::text, 
  'payment_request'::text, 
  'payment_received'::text, 
  'group_invite'::text, 
  'user_joined_group'::text, 
  'user_left_group'::text,
  'bill_settled'::text
]));