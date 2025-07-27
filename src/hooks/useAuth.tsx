import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Auth state changed:', event, !!session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && session) {
          console.log('✅ Token refreshed successfully');
        }
        
        // Handle sign out or token expiration
        if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
          console.log('❌ Session expired or signed out');
          setSession(null);
          setUser(null);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, userData: any) => {
    const redirectUrl = `${window.location.origin}/`;
    
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            user_type: userData.user_type,
            full_name: userData.full_name,
            phone: userData.phone,
            ...(userData.user_type === 'driver' && {
              cnh: userData.cnh,
              vehicle_brand: userData.vehicle_brand,
              vehicle_model: userData.vehicle_model,
              vehicle_plate: userData.vehicle_plate,
              vehicle_color: userData.vehicle_color,
              vehicle_type: userData.vehicle_type,
            })
          }
        }
      });
      
      return { error, data };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    try {
      console.log('🚪 Iniciando logout...');
      
      // Verificar se existe sessão antes de tentar logout
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        console.log('ℹ️ Nenhuma sessão ativa encontrada, apenas limpando estado local');
      } else {
        console.log('🔄 Sessão ativa encontrada, processando logout...');
        const { error } = await supabase.auth.signOut();
        
        // Tratar AuthSessionMissingError como sucesso
        if (error && error.message?.includes('Auth session missing')) {
          console.log('ℹ️ Sessão já expirada, continuando com limpeza do estado');
        } else if (error) {
          console.error('❌ Erro durante logout:', error);
          // Mesmo com erro, vamos limpar o estado local
        }
      }
      
      console.log('✅ Limpando estado local...');
      
      // Sempre limpar estado local, independentemente do resultado da API
      setSession(null);
      setUser(null);
      setLoading(false);
      
      console.log('✅ Logout concluído com sucesso');
      
    } catch (error: any) {
      console.log('⚠️ Erro capturado, mas limpando estado local mesmo assim:', error);
      
      // Mesmo com erro, limpar estado local para garantir logout
      setSession(null);
      setUser(null);
      setLoading(false);
      
      // Não re-throw do erro se for AuthSessionMissingError
      if (error.message?.includes('Auth session missing')) {
        console.log('ℹ️ Erro de sessão ausente tratado como sucesso');
        return;
      }
      
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};