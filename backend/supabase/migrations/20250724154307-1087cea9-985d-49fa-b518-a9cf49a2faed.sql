-- Criar tabela de corridas/rides
CREATE TABLE public.rides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id UUID NOT NULL REFERENCES auth.users(id),
  driver_id UUID REFERENCES auth.users(id),
  pickup_address TEXT NOT NULL,
  pickup_latitude DOUBLE PRECISION NOT NULL,
  pickup_longitude DOUBLE PRECISION NOT NULL,
  destination_address TEXT NOT NULL,
  destination_latitude DOUBLE PRECISION NOT NULL,
  destination_longitude DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'driver_arriving', 'driver_arrived', 'in_progress', 'completed', 'cancelled')),
  estimated_price DECIMAL(10,2),
  actual_price DECIMAL(10,2),
  estimated_duration_minutes INTEGER,
  estimated_distance_km DECIMAL(8,2),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  pickup_arrived_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Criar policies para rides
CREATE POLICY "Passengers can view their own rides" 
ON public.rides 
FOR SELECT 
USING (auth.uid() = passenger_id);

CREATE POLICY "Drivers can view their assigned rides" 
ON public.rides 
FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Passengers can create rides" 
ON public.rides 
FOR INSERT 
WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Drivers can update their assigned rides" 
ON public.rides 
FOR UPDATE 
USING (auth.uid() = driver_id);

-- Criar índices para performance
CREATE INDEX idx_rides_status ON public.rides(status);
CREATE INDEX idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX idx_rides_passenger_id ON public.rides(passenger_id);
CREATE INDEX idx_rides_requested_at ON public.rides(requested_at);
CREATE INDEX idx_rides_pickup_location ON public.rides(pickup_latitude, pickup_longitude);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_rides_updated_at
BEFORE UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar real-time para a tabela rides
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;