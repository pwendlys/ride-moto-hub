-- Aumentar tempo de expiração das notificações para 5 minutos
ALTER TABLE public.ride_notifications 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '5 minutes');

-- Adicionar realtime para as tabelas principais
ALTER TABLE public.ride_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;

-- Adicionar às publicações realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;