-- Criar tabela para controlar notificações com timer
CREATE TABLE public.ride_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  position_in_queue INTEGER NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '45 seconds'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  distance_km NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ride_notifications_ride_id ON public.ride_notifications(ride_id);
CREATE INDEX idx_ride_notifications_driver_id ON public.ride_notifications(driver_id);
CREATE INDEX idx_ride_notifications_status ON public.ride_notifications(status);
CREATE INDEX idx_ride_notifications_expires_at ON public.ride_notifications(expires_at);

-- RLS policies
ALTER TABLE public.ride_notifications ENABLE ROW LEVEL SECURITY;

-- Motoristas podem ver suas próprias notificações
CREATE POLICY "Drivers can view their own notifications" 
ON public.ride_notifications 
FOR SELECT 
USING (auth.uid() = driver_id);

-- Sistema pode inserir notificações
CREATE POLICY "System can manage notifications" 
ON public.ride_notifications 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_ride_notifications_updated_at
BEFORE UPDATE ON public.ride_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER TABLE public.ride_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_notifications;