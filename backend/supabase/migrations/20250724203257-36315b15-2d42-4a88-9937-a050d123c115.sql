-- Aumentar tempo de expiração das notificações de 45 segundos para 60 segundos
ALTER TABLE ride_notifications 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '60 seconds');