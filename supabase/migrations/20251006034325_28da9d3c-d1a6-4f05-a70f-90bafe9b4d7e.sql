-- Fix 1: Prevent race condition in trip joining with atomic seat decrement
-- This ensures only one user can claim each seat, preventing overbooking

-- Add constraint to prevent negative seats
ALTER TABLE public.trips
ADD CONSTRAINT trips_no_negative_seats
CHECK (available_seats >= 0);

-- Add unique constraint to prevent duplicate joins
ALTER TABLE public.trip_participants
ADD CONSTRAINT unique_passenger_trip
UNIQUE (trip_id, passenger_id);

-- Create function to atomically decrement seats
CREATE OR REPLACE FUNCTION public.decrement_available_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trips
  SET available_seats = available_seats - 1
  WHERE id = NEW.trip_id
    AND available_seats > 0;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip is full or does not exist';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce atomic seat updates
CREATE TRIGGER check_seats_before_join
BEFORE INSERT ON trip_participants
FOR EACH ROW
EXECUTE FUNCTION decrement_available_seats();

-- Create function to atomically increment seats on leave
CREATE OR REPLACE FUNCTION public.increment_available_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trips
  SET available_seats = available_seats + 1
  WHERE id = OLD.trip_id;
  
  RETURN OLD;
END;
$$;

-- Create trigger to restore seats when participant leaves
CREATE TRIGGER restore_seats_on_leave
AFTER DELETE ON trip_participants
FOR EACH ROW
EXECUTE FUNCTION increment_available_seats();

-- Fix 2: Enforce driver verification for trip creation
-- Only approved drivers with documents can create trips

DROP POLICY "Drivers can create trips" ON public.trips;

CREATE POLICY "Verified drivers can create trips"
ON public.trips FOR INSERT
WITH CHECK (
  auth.uid() = driver_id
  AND EXISTS (
    SELECT 1 FROM driver_documents
    WHERE driver_id = auth.uid()
      AND drivers_license_path IS NOT NULL
      AND drivers_license_path != ''
      AND insurance_card_path IS NOT NULL
      AND insurance_card_path != ''
      AND verification_status = 'approved'
  )
);

-- Fix 3: Restrict trip participant visibility to trip members only
-- Prevents privacy invasion and tracking

DROP POLICY "Anyone can view trip participants" ON public.trip_participants;

CREATE POLICY "Trip members can view participants"
ON public.trip_participants FOR SELECT
USING (
  auth.uid() IN (
    SELECT driver_id FROM trips WHERE id = trip_participants.trip_id
    UNION
    SELECT passenger_id FROM trip_participants WHERE trip_id = trip_participants.trip_id
  )
);

-- Fix 4: Remove duplicate storage policies for cleaner maintenance

DROP POLICY IF EXISTS "Drivers can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can upload own documents" ON storage.objects;