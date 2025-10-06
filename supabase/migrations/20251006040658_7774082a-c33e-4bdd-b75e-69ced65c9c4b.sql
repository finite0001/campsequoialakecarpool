-- Configure storage bucket to only accept specific MIME types for driver documents
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf']
WHERE id = 'driver-documents';