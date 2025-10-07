-- Fix critical security issue: Change default verification_status from 'approved' to 'pending'
-- This ensures defense-in-depth - even if frontend code fails, database won't auto-approve drivers

ALTER TABLE public.driver_documents 
ALTER COLUMN verification_status SET DEFAULT 'pending'::verification_status;

-- Add comment explaining the security reasoning
COMMENT ON COLUMN public.driver_documents.verification_status IS 
'Driver document verification status. Defaults to pending to require explicit admin approval before drivers can create trips.';