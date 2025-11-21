-- Add emergency contact fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- Create trip status enum
DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('upcoming', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status fields to trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS status trip_status DEFAULT 'upcoming';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add distance and duration fields to trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS distance_text TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS duration_text TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS distance_miles NUMERIC;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Create trip reminders table
CREATE TABLE IF NOT EXISTS trip_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reminder_type TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trip check-ins table
CREATE TABLE IF NOT EXISTS trip_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checked_in_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'checked_in'
);

-- Create broadcast messages table
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT,
  trip_id UUID REFERENCES trips(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create message recipients table
CREATE TABLE IF NOT EXISTS message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES broadcast_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on new tables
ALTER TABLE trip_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_reminders
CREATE POLICY "Users can view own reminders" ON trip_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert reminders" ON trip_reminders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update reminders" ON trip_reminders
  FOR UPDATE USING (true);

-- RLS policies for trip_checkins
CREATE POLICY "Trip drivers can view check-ins" ON trip_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_checkins.trip_id 
      AND trips.driver_id = auth.uid()
    ) OR is_admin(auth.uid())
  );

CREATE POLICY "Trip drivers can manage check-ins" ON trip_checkins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_checkins.trip_id 
      AND trips.driver_id = auth.uid()
    ) OR is_admin(auth.uid())
  );

-- RLS policies for broadcast_messages
CREATE POLICY "Admins can manage broadcasts" ON broadcast_messages
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can view broadcasts sent to them" ON broadcast_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM message_recipients 
      WHERE message_recipients.message_id = broadcast_messages.id 
      AND message_recipients.user_id = auth.uid()
    ) OR is_admin(auth.uid())
  );

-- RLS policies for message_recipients
CREATE POLICY "Users can view own message receipts" ON message_recipients
  FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage message recipients" ON message_recipients
  FOR ALL USING (is_admin(auth.uid()));