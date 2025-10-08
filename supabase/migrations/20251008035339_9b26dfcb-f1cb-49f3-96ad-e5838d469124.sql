-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Verified drivers can create trips" ON trips;

-- Create new policy that allows both verified drivers AND admins to create trips
CREATE POLICY "Verified drivers and admins can create trips"
ON trips
FOR INSERT
WITH CHECK (
  (auth.uid() = driver_id AND (
    -- Verified driver check
    EXISTS (
      SELECT 1 FROM driver_documents
      WHERE driver_id = auth.uid()
        AND drivers_license_path IS NOT NULL
        AND drivers_license_path <> ''
        AND insurance_card_path IS NOT NULL
        AND insurance_card_path <> ''
        AND verification_status = 'approved'
    )
    -- OR admin check
    OR is_admin(auth.uid())
  ))
);