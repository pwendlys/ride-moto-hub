-- Criar tabela para rastreamento de localização dos motoristas
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  heading NUMERIC, -- Direção do veículo em graus
  speed NUMERIC, -- Velocidade em km/h
  accuracy NUMERIC, -- Precisão da localização em metros
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_locations
CREATE POLICY "Admin can view all driver locations" 
ON public.driver_locations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'admin'
  )
);

CREATE POLICY "Drivers can manage their own location" 
ON public.driver_locations 
FOR ALL 
USING (auth.uid() = driver_id);

CREATE POLICY "Passengers can view online driver locations" 
ON public.driver_locations 
FOR SELECT 
USING (
  is_online = true AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'passenger'
  )
);

-- Índices para performance
CREATE INDEX idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX idx_driver_locations_online ON public.driver_locations(is_online);
CREATE INDEX idx_driver_locations_last_update ON public.driver_locations(last_update);

-- Trigger para atualização automática do campo updated_at
CREATE TRIGGER update_driver_locations_updated_at
BEFORE UPDATE ON public.driver_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;