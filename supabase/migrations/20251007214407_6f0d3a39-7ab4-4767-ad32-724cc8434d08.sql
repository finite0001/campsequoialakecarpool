-- Allow admins to view all trip participants
CREATE POLICY "Admins can view all trip participants"
ON public.trip_participants
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow users to view profiles of people in their trips
CREATE POLICY "Users can view carpool member profiles"
ON public.profiles
FOR SELECT
USING (
  -- Can view profile if they're in the same trip as either driver or passenger
  EXISTS (
    SELECT 1 FROM trips t
    WHERE t.driver_id = profiles.id AND (
      t.driver_id = auth.uid() OR
      EXISTS (SELECT 1 FROM trip_participants tp WHERE tp.trip_id = t.id AND tp.passenger_id = auth.uid())
    )
  ) OR
  EXISTS (
    SELECT 1 FROM trip_participants tp1
    JOIN trip_participants tp2 ON tp1.trip_id = tp2.trip_id
    WHERE tp1.passenger_id = profiles.id AND tp2.passenger_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM trip_participants tp
    JOIN trips t ON tp.trip_id = t.id
    WHERE tp.passenger_id = profiles.id AND t.driver_id = auth.uid()
  )
);