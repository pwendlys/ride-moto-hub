-- Add broadcast_expires_at to rides table for global 50-second timeout
ALTER TABLE public.rides 
ADD COLUMN broadcast_expires_at timestamp with time zone DEFAULT (now() + '00:00:50'::interval);

-- Remove position_in_queue concept since all drivers will see all rides
ALTER TABLE public.ride_notifications 
DROP COLUMN position_in_queue;

-- Update notification expiration to 50 seconds to match broadcast timeout
ALTER TABLE public.ride_notifications 
ALTER COLUMN expires_at SET DEFAULT (now() + '00:00:50'::interval);