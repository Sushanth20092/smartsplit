-- SQL function to mark bill creator as paid
-- This function runs with elevated privileges to bypass RLS
-- Add this to your Supabase SQL editor

CREATE OR REPLACE FUNCTION mark_creator_as_paid(bill_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
    creator_user_id UUID;
    rows_updated INTEGER;
BEGIN
    -- Get the bill creator
    SELECT created_by INTO creator_user_id
    FROM bills
    WHERE id = bill_id_param;
    
    -- Check if creator was found
    IF creator_user_id IS NULL THEN
        RAISE EXCEPTION 'Bill creator not found for bill_id: %', bill_id_param;
    END IF;
    
    -- Update the creator's bill_split
    UPDATE bill_splits
    SET 
        paid = true,
        payment_status = 'confirmed',
        paid_at = NOW()
    WHERE 
        bill_id = bill_id_param 
        AND user_id = creator_user_id
        AND payment_status != 'confirmed'; -- Only update if not already confirmed
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    -- Log the operation
    RAISE NOTICE 'Updated % rows for creator % in bill %', rows_updated, creator_user_id, bill_id_param;
    
    RETURN rows_updated > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_creator_as_paid(UUID) TO authenticated;