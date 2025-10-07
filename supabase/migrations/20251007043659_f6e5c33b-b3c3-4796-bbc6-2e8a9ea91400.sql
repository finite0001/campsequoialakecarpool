-- Add RLS policies for storage.objects for driver-documents bucket
-- This ensures users can only access their own documents and admins can view all

-- Users can only view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only upload to their own folder
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' AND
  public.is_admin(auth.uid())
);