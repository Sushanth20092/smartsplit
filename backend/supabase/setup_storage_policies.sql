-- Create storage bucket for bills if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bills',
  'bills',
  false,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload bills to their groups" ON storage.objects;
DROP POLICY IF EXISTS "Users can view bills from their groups" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete bills from their groups" ON storage.objects;

-- Create storage policies for bills bucket
-- Policy 1: Allow authenticated users to upload to bills bucket
CREATE POLICY "Users can upload bills to their groups" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bills' 
    AND auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
  );

-- Policy 2: Allow users to view bills from groups they belong to
CREATE POLICY "Users can view bills from their groups" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bills' 
    AND auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
  );

-- Policy 3: Allow users to delete their own uploaded bills
CREATE POLICY "Users can delete bills from their groups" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bills' 
    AND auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
  );

-- Policy 4: Allow users to update their own uploaded bills
CREATE POLICY "Users can update bills from their groups" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'bills' 
    AND auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
  );

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;