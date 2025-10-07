-- Drop the problematic policy
DROP POLICY IF EXISTS "Trip members can view participants" ON public.trip_participants;

-- Create a security definer function to check if user can view trip participants
CREATE OR REPLACE FUNCTION public.can_view_trip_participants(_user_id uuid, _trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is the driver of the trip OR a passenger in the trip
  SELECT EXISTS (
    SELECT 1 FROM trips WHERE id = _trip_id AND driver_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM trip_participants WHERE trip_id = _trip_id AND passenger_id = _user_id
  );
$$;

-- Create new policy using the security definer function
CREATE POLICY "Trip members can view participants" 
ON public.trip_participants 
FOR SELECT 
USING (
  public.can_view_trip_participants(auth.uid(), trip_id)
);