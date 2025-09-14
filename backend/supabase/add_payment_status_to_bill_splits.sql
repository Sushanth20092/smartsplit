-- Add payment_status column to bill_splits table for secure payment verification
-- This enables the proof submission and verification workflow

-- Add payment_status column with proper constraints
ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'::text 
CHECK (payment_status = ANY (ARRAY['pending'::text, 'submitted'::text, 'confirmed'::text, 'rejected'::text]));

-- Add rejection_reason column for when payments are rejected
ALTER TABLE public.bill_splits 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update existing records to have 'confirmed' status if they are already paid
UPDATE public.bill_splits 
SET payment_status = 'confirmed' 
WHERE paid = true AND payment_status = 'pending';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_bill_splits_payment_status ON public.bill_splits(payment_status);
CREATE INDEX IF NOT EXISTS idx_bill_splits_bill_id_payment_status ON public.bill_splits(bill_id, payment_status);

-- Add comment for documentation
COMMENT ON COLUMN public.bill_splits.payment_status IS 'Payment verification status: pending (no proof), submitted (proof uploaded), confirmed (verified by creator), rejected (proof rejected)';
COMMENT ON COLUMN public.bill_splits.rejection_reason IS 'Reason provided by creator when rejecting payment proof';