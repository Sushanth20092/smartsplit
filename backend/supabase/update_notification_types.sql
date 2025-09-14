-- Update notification types to include new event types
-- Run this in your Supabase SQL Editor

-- First, drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with additional notification types including secure payment types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
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

-- Verify the constraint was updated
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'notifications'::regclass 
AND conname = 'notifications_type_check';
