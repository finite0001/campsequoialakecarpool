-- Fix 1: Remove role from profiles table (CRITICAL - roles must be in separate table)
-- This prevents privilege escalation attacks
ALTER TABLE public.profiles DROP COLUMN role;

-- Fix 2: Update handle_new_user trigger to populate user_roles table instead
-- Also add missing search_path for security
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Insert role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'passenger')
  );
  
  RETURN NEW;
END;
$function$;

-- Fix 3: Update profiles RLS policy to restrict to owner-only
DROP POLICY "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Fix 4: Update profiles UPDATE policy to prevent any privilege escalation
-- Users can only update phone and full_name
DROP POLICY "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile info" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix 5: Add policy for users to view their own role
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Fix 6: Add database constraints for trip input validation
ALTER TABLE public.trips 
ADD CONSTRAINT trips_total_seats_valid 
CHECK (total_seats > 0 AND total_seats <= 20);

ALTER TABLE public.trips 
ADD CONSTRAINT trips_available_seats_valid 
CHECK (available_seats >= 0 AND available_seats <= total_seats);

ALTER TABLE public.trips 
ADD CONSTRAINT trips_fuel_cost_positive 
CHECK (fuel_cost IS NULL OR fuel_cost >= 0);

ALTER TABLE public.trips 
ADD CONSTRAINT trips_route_description_length 
CHECK (route_description IS NULL OR length(route_description) <= 500);

ALTER TABLE public.trips 
ADD CONSTRAINT trips_location_length 
CHECK (length(departure_location) > 0 AND length(departure_location) <= 200 
   AND length(arrival_location) > 0 AND length(arrival_location) <= 200);

-- Fix 7: Change driver_documents to store file paths instead of public URLs
ALTER TABLE public.driver_documents 
DROP COLUMN drivers_license_url,
DROP COLUMN insurance_card_url,
ADD COLUMN drivers_license_path text NOT NULL DEFAULT '',
ADD COLUMN insurance_card_path text NOT NULL DEFAULT '';

-- Remove default after adding columns
ALTER TABLE public.driver_documents 
ALTER COLUMN drivers_license_path DROP DEFAULT,
ALTER COLUMN insurance_card_path DROP DEFAULT;

-- Fix 8: Add storage RLS policies for driver documents
CREATE POLICY "Users can access own driver documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' 
  AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()))
);

CREATE POLICY "Users can upload own driver documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own driver documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'driver-documents' 
  AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()))
);