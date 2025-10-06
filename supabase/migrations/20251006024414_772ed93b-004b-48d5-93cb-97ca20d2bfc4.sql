-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'passenger');

-- Create enum for driver verification status
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role app_role NOT NULL DEFAULT 'passenger',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table for admin assignments
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create driver_documents table
CREATE TABLE public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  drivers_license_url TEXT NOT NULL,
  insurance_card_url TEXT NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'approved',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id)
);

-- Enable RLS on driver_documents
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- Create trips table
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  departure_location TEXT NOT NULL,
  arrival_location TEXT NOT NULL,
  route_description TEXT,
  departure_datetime TIMESTAMPTZ NOT NULL,
  total_seats INTEGER NOT NULL CHECK (total_seats > 0),
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
  fuel_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on trips
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Create trip_participants table
CREATE TABLE public.trip_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, passenger_id)
);

-- Enable RLS on trip_participants
ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

-- Create liability_acknowledgments table
CREATE TABLE public.liability_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on liability_acknowledgments
ALTER TABLE public.liability_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-documents', 'driver-documents', false);

-- Create function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'passenger')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for driver_documents
CREATE POLICY "Drivers can view own documents"
  ON public.driver_documents FOR SELECT
  USING (auth.uid() = driver_id OR public.is_admin(auth.uid()));

CREATE POLICY "Drivers can insert own documents"
  ON public.driver_documents FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update own documents"
  ON public.driver_documents FOR UPDATE
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all documents"
  ON public.driver_documents FOR SELECT
  USING (public.is_admin(auth.uid()));

-- RLS Policies for trips
CREATE POLICY "Anyone can view trips"
  ON public.trips FOR SELECT
  USING (true);

CREATE POLICY "Drivers can create trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can delete own trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = driver_id);

-- RLS Policies for trip_participants
CREATE POLICY "Anyone can view trip participants"
  ON public.trip_participants FOR SELECT
  USING (true);

CREATE POLICY "Passengers can join trips"
  ON public.trip_participants FOR INSERT
  WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Passengers can leave trips"
  ON public.trip_participants FOR DELETE
  USING (auth.uid() = passenger_id);

-- RLS Policies for liability_acknowledgments
CREATE POLICY "Users can view own acknowledgment"
  ON public.liability_acknowledgments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own acknowledgment"
  ON public.liability_acknowledgments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all acknowledgments"
  ON public.liability_acknowledgments FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Storage policies for driver-documents bucket
CREATE POLICY "Drivers can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'driver-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Drivers can view own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'driver-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all driver documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'driver-documents' 
    AND public.is_admin(auth.uid())
  );