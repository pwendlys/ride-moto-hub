-- Corrigir problemas de autenticação e vinculação com Supabase

-- Primeiro, vamos garantir que todos os tipos existem
DO $$ BEGIN
    CREATE TYPE public.user_type AS ENUM ('passenger', 'driver', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.driver_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'car');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recriar a função de criação automática de perfil
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Garantir que as tabelas existem com as estruturas corretas
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    user_type public.user_type NOT NULL DEFAULT 'passenger',
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    cnh TEXT NOT NULL DEFAULT '',
    vehicle_brand TEXT NOT NULL DEFAULT '',
    vehicle_model TEXT NOT NULL DEFAULT '',
    vehicle_plate TEXT NOT NULL DEFAULT '',
    vehicle_color TEXT NOT NULL DEFAULT '',
    vehicle_type public.vehicle_type NOT NULL DEFAULT 'motorcycle',
    status public.driver_status NOT NULL DEFAULT 'pending',
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Garantir que o RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Recriar políticas básicas de segurança
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Políticas para drivers
DROP POLICY IF EXISTS "Drivers can view their own data" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can update their own data" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can insert their own data" ON public.drivers;

CREATE POLICY "Drivers can view their own data" 
ON public.drivers FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update their own data" 
ON public.drivers FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Drivers can insert their own data" 
ON public.drivers FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Criar um usuário admin padrão (opcional)
-- Você pode comentar esta parte se não quiser um admin automático
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    is_super_admin
) VALUES (
    gen_random_uuid(),
    'admin@motohub.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"user_type": "admin", "full_name": "Administrador", "phone": ""}',
    false
) ON CONFLICT (email) DO NOTHING;