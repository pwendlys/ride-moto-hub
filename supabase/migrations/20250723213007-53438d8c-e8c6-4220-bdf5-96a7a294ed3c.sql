-- Verificar e corrigir o trigger de criação automática de perfil

-- Verificar se o trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Recriar a função de forma mais robusta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();