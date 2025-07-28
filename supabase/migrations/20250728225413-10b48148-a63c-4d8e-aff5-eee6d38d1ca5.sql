-- Configure Realtime for rides table
ALTER TABLE public.rides REPLICA IDENTITY FULL;

-- Add rides table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;

-- Configure Realtime for ride_notifications table (if not already done)
ALTER TABLE public.ride_notifications REPLICA IDENTITY FULL;

-- Extend notification expiration time from 5 minutes to 10 minutes
ALTER TABLE public.ride_notifications 
ALTER COLUMN expires_at SET DEFAULT (now() + '00:10:00'::interval);