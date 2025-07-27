-- Apenas aumentar tempo de expiração das notificações para 5 minutos
ALTER TABLE public.ride_notifications 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '5 minutes');