-- =====================================================
-- BACKUP COMPLETO DO BANCO DE DADOS - MOTOTAXI APP
-- =====================================================

-- Remover objetos existentes se existirem (para migração limpa)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_drivers_updated_at ON public.drivers;
DROP TRIGGER IF EXISTS update_rides_updated_at ON public.rides;
DROP TRIGGER IF EXISTS update_ride_notifications_updated_at ON public.ride_notifications;
DROP TRIGGER IF EXISTS update_financial_transfers_updated_at ON public.financial_transfers;
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
DROP TRIGGER IF EXISTS update_driver_locations_updated_at ON public.driver_locations;
DROP TRIGGER IF EXISTS validate_ride_data_trigger ON public.rides;
DROP TRIGGER IF EXISTS validate_system_settings_trigger ON public.system_settings;
DROP TRIGGER IF EXISTS validate_driver_location_trigger ON public.driver_locations;
DROP TRIGGER IF EXISTS trigger_ride_queue_manager_trigger ON public.rides;

-- =====================================================
-- 1. ENUMS (TIPOS ENUMERADOS)
-- =====================================================

DO $$ BEGIN
    CREATE TYPE public.user_type AS ENUM ('passenger', 'driver', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'car');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.driver_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.ride_status AS ENUM ('requested', 'accepted', 'in_progress', 'completed', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'pix', 'card');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. FUNÇÕES (FUNCTIONS)
-- =====================================================

-- Função para obter role do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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

-- Função para validar coordenadas
CREATE OR REPLACE FUNCTION public.validate_coordinates(lat numeric, lng numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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

-- Função para validar configurações de preço
CREATE OR REPLACE FUNCTION public.validate_pricing_settings(fixed_rate_val numeric, price_per_km_val numeric, minimum_fare_val numeric, app_fee_percentage_val numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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

-- Função para limpeza de corridas e notificações expiradas
CREATE OR REPLACE FUNCTION public.cleanup_expired_rides_and_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- Função trigger para validar dados de corrida
CREATE OR REPLACE FUNCTION public.validate_ride_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Função trigger para validar configurações do sistema
CREATE OR REPLACE FUNCTION public.validate_system_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Função trigger para validar localização do motorista
CREATE OR REPLACE FUNCTION public.validate_driver_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Função trigger para gerenciar fila de corridas
CREATE OR REPLACE FUNCTION public.trigger_ride_queue_manager()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- Função trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Função trigger para lidar com novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
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

-- =====================================================
-- 3. TABELAS (TABLES)
-- =====================================================

-- Tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    user_type public.user_type NOT NULL DEFAULT 'passenger'::public.user_type,
    full_name text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de motoristas
CREATE TABLE IF NOT EXISTS public.drivers (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    cnh text NOT NULL DEFAULT '',
    vehicle_brand text NOT NULL DEFAULT '',
    vehicle_model text NOT NULL DEFAULT '',
    vehicle_plate text NOT NULL DEFAULT '',
    vehicle_color text NOT NULL DEFAULT '',
    vehicle_type public.vehicle_type NOT NULL DEFAULT 'motorcycle'::public.vehicle_type,
    status public.driver_status NOT NULL DEFAULT 'pending'::public.driver_status,
    total_rides integer DEFAULT 0,
    rating numeric DEFAULT 5.00,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de localizações dos motoristas
CREATE TABLE IF NOT EXISTS public.driver_locations (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id uuid NOT NULL,
    lat numeric NOT NULL,
    lng numeric NOT NULL,
    heading numeric,
    speed numeric,
    accuracy numeric,
    is_online boolean NOT NULL DEFAULT false,
    last_update timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de corridas
CREATE TABLE IF NOT EXISTS public.rides (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    passenger_id uuid NOT NULL,
    driver_id uuid,
    status public.ride_status NOT NULL DEFAULT 'requested'::public.ride_status,
    origin_address text NOT NULL DEFAULT '',
    destination_address text NOT NULL DEFAULT '',
    origin_lat numeric NOT NULL,
    origin_lng numeric NOT NULL,
    destination_lat numeric NOT NULL,
    destination_lng numeric NOT NULL,
    distance_km numeric,
    estimated_duration_minutes integer,
    estimated_price numeric,
    final_price numeric,
    payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
    payment_status text DEFAULT 'pending'::text,
    passenger_comment text,
    driver_comment text,
    passenger_rating integer,
    driver_rating integer,
    requested_at timestamp with time zone NOT NULL DEFAULT now(),
    accepted_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    broadcast_expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de notificações de corridas
CREATE TABLE IF NOT EXISTS public.ride_notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    distance_km numeric,
    notified_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:03:00'::interval),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de transferências financeiras
CREATE TABLE IF NOT EXISTS public.financial_transfers (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    ride_value numeric NOT NULL,
    app_fee numeric NOT NULL,
    driver_amount numeric NOT NULL,
    transfer_status text DEFAULT 'pending'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pricing_model text NOT NULL DEFAULT 'per_km'::text,
    fixed_rate numeric NOT NULL DEFAULT 5.00,
    price_per_km numeric NOT NULL DEFAULT 2.50,
    minimum_fare numeric NOT NULL DEFAULT 8.00,
    app_fee_percentage numeric NOT NULL DEFAULT 20.00,
    fee_type text NOT NULL DEFAULT 'percentage'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. ÍNDICES (INDEXES)
-- =====================================================

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online ON public.driver_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_driver_locations_last_update ON public.driver_locations(last_update);
CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON public.rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_requested_at ON public.rides(requested_at);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_driver_id ON public.ride_notifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_ride_id ON public.ride_notifications(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_status ON public.ride_notifications(status);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_expires_at ON public.ride_notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_financial_transfers_driver_id ON public.financial_transfers(driver_id);
CREATE INDEX IF NOT EXISTS idx_financial_transfers_ride_id ON public.financial_transfers(ride_id);

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Trigger para novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
    BEFORE UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ride_notifications_updated_at
    BEFORE UPDATE ON public.ride_notifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_transfers_updated_at
    BEFORE UPDATE ON public.financial_transfers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_locations_updated_at
    BEFORE UPDATE ON public.driver_locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Triggers de validação
CREATE TRIGGER validate_ride_data_trigger
    BEFORE INSERT OR UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION public.validate_ride_data();

CREATE TRIGGER validate_system_settings_trigger
    BEFORE INSERT OR UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.validate_system_settings();

CREATE TRIGGER validate_driver_location_trigger
    BEFORE INSERT OR UPDATE ON public.driver_locations
    FOR EACH ROW EXECUTE FUNCTION public.validate_driver_location();

-- Trigger para gerenciar fila de corridas
CREATE TRIGGER trigger_ride_queue_manager_trigger
    AFTER INSERT ON public.rides
    FOR EACH ROW EXECUTE FUNCTION public.trigger_ride_queue_manager();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) - HABILITAÇÃO
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. POLÍTICAS RLS (ROW LEVEL SECURITY POLICIES)
-- =====================================================

-- Políticas para PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update driver profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all profiles" ON public.profiles
    FOR SELECT USING ((auth.uid() = user_id) OR (get_current_user_role() = 'admin'::text));

CREATE POLICY "Admin can update driver profiles" ON public.profiles
    FOR UPDATE USING ((auth.uid() = user_id) OR (get_current_user_role() = 'admin'::text));

-- Políticas para DRIVERS
DROP POLICY IF EXISTS "Drivers can view their own data" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can insert their own data" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can update their own data" ON public.drivers;
DROP POLICY IF EXISTS "Admin can view all drivers" ON public.drivers;
DROP POLICY IF EXISTS "Admin can update all drivers" ON public.drivers;

CREATE POLICY "Drivers can view their own data" ON public.drivers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Drivers can insert their own data" ON public.drivers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Drivers can update their own data" ON public.drivers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all drivers" ON public.drivers
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.user_type = 'admin'::user_type
    ));

CREATE POLICY "Admin can update all drivers" ON public.drivers
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.user_type = 'admin'::user_type
    ));

-- Políticas para DRIVER_LOCATIONS
DROP POLICY IF EXISTS "Drivers can manage their own location" ON public.driver_locations;
DROP POLICY IF EXISTS "Passengers can view online driver locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Admin can view all driver locations" ON public.driver_locations;

CREATE POLICY "Drivers can manage their own location" ON public.driver_locations
    FOR ALL USING (auth.uid() = driver_id);

CREATE POLICY "Passengers can view online driver locations" ON public.driver_locations
    FOR SELECT USING (
        is_online = true 
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.user_type = 'passenger'::user_type
        )
    );

CREATE POLICY "Admin can view all driver locations" ON public.driver_locations
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.user_type = 'admin'::user_type
    ));

-- Políticas para RIDES
DROP POLICY IF EXISTS "Users can view their own rides" ON public.rides;
DROP POLICY IF EXISTS "Passengers can create rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can update rides assigned to them" ON public.rides;
DROP POLICY IF EXISTS "Admin can view all rides" ON public.rides;

CREATE POLICY "Users can view their own rides" ON public.rides
    FOR SELECT USING ((auth.uid() = passenger_id) OR (auth.uid() = driver_id));

CREATE POLICY "Passengers can create rides" ON public.rides
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Drivers can update rides assigned to them" ON public.rides
    FOR UPDATE USING ((auth.uid() = driver_id) OR (auth.uid() = passenger_id));

CREATE POLICY "Admin can view all rides" ON public.rides
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.user_type = 'admin'::user_type
    ));

-- Políticas para RIDE_NOTIFICATIONS
DROP POLICY IF EXISTS "Drivers can view their own notifications" ON public.ride_notifications;
DROP POLICY IF EXISTS "System can manage notifications" ON public.ride_notifications;

CREATE POLICY "Drivers can view their own notifications" ON public.ride_notifications
    FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "System can manage notifications" ON public.ride_notifications
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para FINANCIAL_TRANSFERS
DROP POLICY IF EXISTS "Drivers can view their own transfers" ON public.financial_transfers;
DROP POLICY IF EXISTS "Admin can view all transfers" ON public.financial_transfers;

CREATE POLICY "Drivers can view their own transfers" ON public.financial_transfers
    FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Admin can view all transfers" ON public.financial_transfers
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.user_type = 'admin'::user_type
    ));

-- Políticas para SYSTEM_SETTINGS
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admin can manage system settings" ON public.system_settings;

CREATE POLICY "Anyone can read system settings" ON public.system_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage system settings" ON public.system_settings
    FOR ALL USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.user_type = 'admin'::user_type
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.user_type = 'admin'::user_type
    ));

-- =====================================================
-- 8. DADOS PADRÃO (DEFAULT DATA)
-- =====================================================

-- Inserir configurações padrão do sistema
INSERT INTO public.system_settings (
    pricing_model,
    fixed_rate,
    price_per_km,
    minimum_fare,
    app_fee_percentage,
    fee_type
) VALUES (
    'per_km',
    5.00,
    2.50,
    8.00,
    20.00,
    'percentage'
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 9. HABILITAÇÃO DE REALTIME (OPCIONAL)
-- =====================================================

-- Para habilitar realtime nas tabelas (execute se necessário)
-- ALTER TABLE public.profiles REPLICA IDENTITY FULL;
-- ALTER TABLE public.drivers REPLICA IDENTITY FULL;
-- ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
-- ALTER TABLE public.rides REPLICA IDENTITY FULL;
-- ALTER TABLE public.ride_notifications REPLICA IDENTITY FULL;
-- ALTER TABLE public.financial_transfers REPLICA IDENTITY FULL;
-- ALTER TABLE public.system_settings REPLICA IDENTITY FULL;

-- =====================================================
-- FIM DO BACKUP
-- =====================================================

-- Log de conclusão
DO $$
BEGIN
    RAISE LOG 'Backup SQL executado com sucesso - Todas as tabelas, funções, triggers e políticas RLS foram criadas/atualizadas';
END $$;