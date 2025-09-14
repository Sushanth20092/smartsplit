-- Create RLS policies for notifications table
-- Run this in your Supabase SQL Editor

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

-- Verify RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 1. Allow users to view their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- 2. Allow users to update their own notifications (for marking as read)
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Allow the service role to insert notifications (for system-generated notifications)
CREATE POLICY "Service role can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 4. Allow authenticated users to insert notifications (for user-generated notifications)
CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;
