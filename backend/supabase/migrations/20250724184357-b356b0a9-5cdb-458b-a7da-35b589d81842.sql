-- Remover política atual que restringe acesso apenas a admins
DROP POLICY IF EXISTS "Admin can manage system settings" ON public.system_settings;

-- Criar novas políticas mais granulares
-- Política para permitir leitura por todos os usuários autenticados
CREATE POLICY "Anyone can read system settings" 
ON public.system_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Política para permitir escrita apenas por admins
CREATE POLICY "Admin can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'admin'::user_type
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'admin'::user_type
));

-- Garantir que existe ao menos uma configuração padrão
INSERT INTO public.system_settings (
  fixed_rate, 
  price_per_km, 
  minimum_fare, 
  app_fee_percentage, 
  pricing_model, 
  fee_type
) 
SELECT 5.00, 2.50, 8.00, 20.00, 'per_km', 'percentage'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);