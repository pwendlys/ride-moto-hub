-- Fix database security issues identified in security review

-- 1. Update existing functions to include proper search_path for security
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN (
    SELECT user_type::text 
    FROM public.profiles 
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
BEGIN
    -- Inserir perfil básico
    INSERT INTO public.profiles (user_id, user_type, full_name, phone)
    VALUES (
        NEW.id, 
        COALESCE((NEW.raw_user_meta_data ->> 'user_type')::public.user_type, 'passenger'::public.user_type),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
    );

    -- Se for motorista, criar registro na tabela drivers
    IF COALESCE((NEW.raw_user_meta_data ->> 'user_type')::public.user_type, 'passenger'::public.user_type) = 'driver' THEN
        INSERT INTO public.drivers (
            user_id, 
            cnh, 
            vehicle_brand, 
            vehicle_model, 
            vehicle_plate, 
            vehicle_color, 
            vehicle_type,
            status
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'cnh', ''),
            COALESCE(NEW.raw_user_meta_data ->> 'vehicle_brand', ''),
            COALESCE(NEW.raw_user_meta_data ->> 'vehicle_model', ''),
            COALESCE(NEW.raw_user_meta_data ->> 'vehicle_plate', ''),
            COALESCE(NEW.raw_user_meta_data ->> 'vehicle_color', ''),
            COALESCE((NEW.raw_user_meta_data ->> 'vehicle_type')::public.vehicle_type, 'motorcycle'::public.vehicle_type),
            'pending'::public.driver_status
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log do erro (opcional)
        RAISE LOG 'Erro ao criar perfil: %', SQLERRM;
        RETURN NEW;
END;
$function$;

-- 2. Add input validation functions with proper bounds checking
CREATE OR REPLACE FUNCTION public.validate_coordinates(lat numeric, lng numeric)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Validate latitude and longitude bounds
  IF lat IS NULL OR lng IS NULL THEN
    RETURN false;
  END IF;
  
  -- Latitude must be between -90 and 90
  IF lat < -90 OR lat > 90 THEN
    RETURN false;
  END IF;
  
  -- Longitude must be between -180 and 180
  IF lng < -180 OR lng > 180 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- 3. Add pricing validation function
CREATE OR REPLACE FUNCTION public.validate_pricing_settings(
  fixed_rate_val numeric,
  price_per_km_val numeric,
  minimum_fare_val numeric,
  app_fee_percentage_val numeric
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Validate all pricing values are positive
  IF fixed_rate_val <= 0 OR price_per_km_val <= 0 OR minimum_fare_val <= 0 THEN
    RETURN false;
  END IF;
  
  -- Validate app fee percentage is between 0 and 50%
  IF app_fee_percentage_val < 0 OR app_fee_percentage_val > 50 THEN
    RETURN false;
  END IF;
  
  -- Validate reasonable bounds for pricing
  IF fixed_rate_val > 1000 OR price_per_km_val > 100 OR minimum_fare_val > 500 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- 4. Add validation triggers for rides table
CREATE OR REPLACE FUNCTION public.validate_ride_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Validate coordinates
  IF NOT public.validate_coordinates(NEW.origin_lat, NEW.origin_lng) THEN
    RAISE EXCEPTION 'Invalid origin coordinates';
  END IF;
  
  IF NOT public.validate_coordinates(NEW.destination_lat, NEW.destination_lng) THEN
    RAISE EXCEPTION 'Invalid destination coordinates';
  END IF;
  
  -- Validate addresses are not empty
  IF NEW.origin_address IS NULL OR LENGTH(TRIM(NEW.origin_address)) = 0 THEN
    RAISE EXCEPTION 'Origin address cannot be empty';
  END IF;
  
  IF NEW.destination_address IS NULL OR LENGTH(TRIM(NEW.destination_address)) = 0 THEN
    RAISE EXCEPTION 'Destination address cannot be empty';
  END IF;
  
  -- Validate price bounds if set
  IF NEW.estimated_price IS NOT NULL AND (NEW.estimated_price <= 0 OR NEW.estimated_price > 10000) THEN
    RAISE EXCEPTION 'Invalid estimated price';
  END IF;
  
  IF NEW.final_price IS NOT NULL AND (NEW.final_price <= 0 OR NEW.final_price > 10000) THEN
    RAISE EXCEPTION 'Invalid final price';
  END IF;
  
  -- Validate distance if set
  IF NEW.distance_km IS NOT NULL AND (NEW.distance_km <= 0 OR NEW.distance_km > 1000) THEN
    RAISE EXCEPTION 'Invalid distance';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_ride_data_trigger ON public.rides;
CREATE TRIGGER validate_ride_data_trigger
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ride_data();

-- 5. Add validation trigger for system_settings
CREATE OR REPLACE FUNCTION public.validate_system_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Validate pricing settings
  IF NOT public.validate_pricing_settings(
    NEW.fixed_rate, 
    NEW.price_per_km, 
    NEW.minimum_fare, 
    NEW.app_fee_percentage
  ) THEN
    RAISE EXCEPTION 'Invalid pricing settings - check bounds and values';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_system_settings_trigger ON public.system_settings;
CREATE TRIGGER validate_system_settings_trigger
  BEFORE INSERT OR UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_system_settings();

-- 6. Add validation trigger for driver_locations
CREATE OR REPLACE FUNCTION public.validate_driver_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Validate coordinates
  IF NOT public.validate_coordinates(NEW.lat, NEW.lng) THEN
    RAISE EXCEPTION 'Invalid driver location coordinates';
  END IF;
  
  -- Validate accuracy is reasonable if provided
  IF NEW.accuracy IS NOT NULL AND (NEW.accuracy < 0 OR NEW.accuracy > 10000) THEN
    RAISE EXCEPTION 'Invalid GPS accuracy value';
  END IF;
  
  -- Validate speed is reasonable if provided
  IF NEW.speed IS NOT NULL AND (NEW.speed < 0 OR NEW.speed > 300) THEN
    RAISE EXCEPTION 'Invalid speed value';
  END IF;
  
  -- Validate heading is between 0 and 360 if provided
  IF NEW.heading IS NOT NULL AND (NEW.heading < 0 OR NEW.heading >= 360) THEN
    RAISE EXCEPTION 'Invalid heading value';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_driver_location_trigger ON public.driver_locations;
CREATE TRIGGER validate_driver_location_trigger
  BEFORE INSERT OR UPDATE ON public.driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_driver_location();