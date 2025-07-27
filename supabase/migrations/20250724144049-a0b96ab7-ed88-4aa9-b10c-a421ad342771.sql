-- Adicionar política para admin visualizar todos os perfis
CREATE POLICY "Admin can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM profiles admin_profile
  WHERE ((admin_profile.user_id = auth.uid()) AND (admin_profile.user_type = 'admin'::user_type))));

-- Adicionar política para admin atualizar perfis de motoristas (para aprovação)
CREATE POLICY "Admin can update driver profiles" 
ON public.profiles 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM profiles admin_profile
  WHERE ((admin_profile.user_id = auth.uid()) AND (admin_profile.user_type = 'admin'::user_type))));