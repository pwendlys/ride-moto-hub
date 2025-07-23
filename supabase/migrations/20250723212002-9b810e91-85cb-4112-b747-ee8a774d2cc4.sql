-- Sistema de mototáxi - Criação do banco de dados completo

-- Enum para tipos de usuário
CREATE TYPE public.user_type AS ENUM ('passenger', 'driver', 'admin');

-- Enum para status das corridas
CREATE TYPE public.ride_status AS ENUM ('requested', 'accepted', 'in_progress', 'completed', 'cancelled');

-- Enum para tipos de veículo
CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'car');

-- Enum para métodos de pagamento
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'pix');

-- Enum para status de aprovação de motorista
CREATE TYPE public.driver_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    user_type user_type NOT NULL DEFAULT 'passenger',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela específica para dados de motoristas
CREATE TABLE public.drivers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    cnh TEXT NOT NULL,
    vehicle_brand TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_plate TEXT NOT NULL UNIQUE,
    vehicle_color TEXT NOT NULL,
    vehicle_type vehicle_type NOT NULL DEFAULT 'motorcycle',
    status driver_status NOT NULL DEFAULT 'pending',
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações do sistema
CREATE TABLE public.system_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    price_per_km DECIMAL(10,2) NOT NULL DEFAULT 2.50,
    fixed_rate DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    app_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    minimum_fare DECIMAL(10,2) NOT NULL DEFAULT 8.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de corridas
CREATE TABLE public.rides (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    passenger_id UUID NOT NULL REFERENCES auth.users(id),
    driver_id UUID REFERENCES auth.users(id),
    status ride_status NOT NULL DEFAULT 'requested',
    origin_address TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    origin_lat DECIMAL(10,8) NOT NULL,
    origin_lng DECIMAL(11,8) NOT NULL,
    destination_lat DECIMAL(10,8) NOT NULL,
    destination_lng DECIMAL(11,8) NOT NULL,
    distance_km DECIMAL(10,2),
    estimated_duration_minutes INTEGER,
    estimated_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    payment_method payment_method DEFAULT 'cash',
    payment_status TEXT DEFAULT 'pending',
    passenger_rating INTEGER CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
    driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
    passenger_comment TEXT,
    driver_comment TEXT,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de repasses financeiros
CREATE TABLE public.financial_transfers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES auth.users(id),
    ride_id UUID NOT NULL REFERENCES public.rides(id),
    ride_value DECIMAL(10,2) NOT NULL,
    app_fee DECIMAL(10,2) NOT NULL,
    driver_amount DECIMAL(10,2) NOT NULL,
    transfer_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transfers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para drivers
CREATE POLICY "Drivers can view their own data" 
ON public.drivers FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update their own data" 
ON public.drivers FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Drivers can insert their own data" 
ON public.drivers FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all drivers" 
ON public.drivers FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND user_type = 'admin'
    )
);

CREATE POLICY "Admin can update all drivers" 
ON public.drivers FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND user_type = 'admin'
    )
);

-- Políticas RLS para system_settings (apenas admin)
CREATE POLICY "Admin can manage system settings" 
ON public.system_settings FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND user_type = 'admin'
    )
);

-- Políticas RLS para rides
CREATE POLICY "Users can view their own rides" 
ON public.rides FOR SELECT 
USING (auth.uid() = passenger_id OR auth.uid() = driver_id);

CREATE POLICY "Passengers can create rides" 
ON public.rides FOR INSERT 
WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Drivers can update rides assigned to them" 
ON public.rides FOR UPDATE 
USING (auth.uid() = driver_id OR auth.uid() = passenger_id);

CREATE POLICY "Admin can view all rides" 
ON public.rides FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND user_type = 'admin'
    )
);

-- Políticas RLS para financial_transfers
CREATE POLICY "Drivers can view their own transfers" 
ON public.financial_transfers FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Admin can view all transfers" 
ON public.financial_transfers FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND user_type = 'admin'
    )
);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
    BEFORE UPDATE ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_transfers_updated_at
    BEFORE UPDATE ON public.financial_transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar perfil automaticamente ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, user_type, full_name, phone)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'passenger')::user_type,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil ao registrar usuário
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Inserir configurações padrão do sistema
INSERT INTO public.system_settings (price_per_km, fixed_rate, app_fee_percentage, minimum_fare)
VALUES (2.50, 5.00, 20.00, 8.00);