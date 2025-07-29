-- Increase timeout from 50 seconds to 3 minutes for ride notifications
ALTER TABLE ride_notifications ALTER COLUMN expires_at SET DEFAULT (now() + '00:03:00'::interval);

-- Increase timeout for ride broadcast expiration to 3 minutes as well  
ALTER TABLE rides ALTER COLUMN broadcast_expires_at SET DEFAULT (now() + '00:03:00'::interval);

-- Create function to automatically cleanup expired rides and notifications
CREATE OR REPLACE FUNCTION cleanup_expired_rides_and_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notifications_count int;
  rides_count int;
BEGIN
  -- Log cleanup operation
  RAISE LOG 'Starting cleanup of expired rides and notifications';
  
  -- Update expired ride notifications
  UPDATE ride_notifications 
  SET status = 'expired' 
  WHERE status = 'pending' 
    AND expires_at < now();
  
  -- Get count of affected rows
  GET DIAGNOSTICS notifications_count = ROW_COUNT;
  RAISE LOG 'Cleaned up % expired ride notifications', notifications_count;
  
  -- Update expired rides that are still in requested status
  UPDATE rides 
  SET status = 'expired'
  WHERE status = 'requested' 
    AND broadcast_expires_at < now();
    
  -- Get count of affected rows  
  GET DIAGNOSTICS rides_count = ROW_COUNT;
  RAISE LOG 'Cleaned up % expired rides', rides_count;
END;
$$;

-- Create trigger to call ride-queue-manager edge function when ride is created
CREATE OR REPLACE FUNCTION trigger_ride_queue_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger for new rides with 'requested' status
  IF NEW.status = 'requested' THEN
    -- Log the trigger execution
    RAISE LOG 'Triggering ride queue manager for ride: %', NEW.id;
    
    -- Call the edge function asynchronously using pg_net (if available) or store for processing
    -- For now, we'll log that this should trigger the edge function
    RAISE LOG 'Ride % needs to be processed by ride-queue-manager edge function', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the actual trigger on rides table
DROP TRIGGER IF EXISTS trigger_ride_queue_manager_on_insert ON rides;
CREATE TRIGGER trigger_ride_queue_manager_on_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ride_queue_manager();