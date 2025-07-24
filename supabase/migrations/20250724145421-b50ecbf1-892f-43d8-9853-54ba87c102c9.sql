-- 1. Remover políticas problemáticas que causam recursão
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update driver profiles" ON public.profiles;

-- 2. Criar função SECURITY DEFINER para verificar tipo do usuário sem recursão
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT user_type::text 
    FROM public.profiles 
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Criar políticas RLS seguras usando a função
CREATE POLICY "Admin can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (public.get_current_user_role() = 'admin')
);

CREATE POLICY "Admin can update driver profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (public.get_current_user_role() = 'admin')
);