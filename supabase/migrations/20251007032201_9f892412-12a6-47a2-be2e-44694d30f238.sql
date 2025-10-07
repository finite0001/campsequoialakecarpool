-- Add driver and admin roles to current user
-- This will help with testing the full driver workflow and admin features

-- Get the most recent user (assumed to be your test account)
-- and add both driver and admin roles if they don't already exist

DO $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the most recently created user
  SELECT id INTO current_user_id
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;

  -- Add driver role if not exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Add admin role if not exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Added driver and admin roles to user: %', current_user_id;
END $$;