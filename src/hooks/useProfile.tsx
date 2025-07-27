import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  id: string;
  user_id: string;
  user_type: 'passenger' | 'driver' | 'admin';
  full_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

interface DriverData {
  id: string;
  user_id: string;
  cnh: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  vehicle_type: 'motorcycle' | 'car';
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rating: number;
  total_rides: number;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setProfile(null);
      setDriverData(null);
      setLoading(false);
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        throw new Error(`Erro ao carregar perfil: ${profileError.message}`);
      }

      setProfile(profileData);

      // If user is a driver, load driver data
      if (profileData.user_type === 'driver') {
        const { data: driverDataResponse, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (driverError && driverError.code !== 'PGRST116') {
          throw new Error(`Erro ao carregar dados do motorista: ${driverError.message}`);
        }

        setDriverData(driverDataResponse);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao carregar dados do usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !profile) return { error: 'Usuário não autenticado' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      // Reload profile data
      await loadProfile();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const updateDriverData = async (updates: Partial<DriverData>) => {
    if (!user || !driverData) return { error: 'Dados do motorista não disponíveis' };

    try {
      const { error } = await supabase
        .from('drivers')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      // Reload driver data
      await loadProfile();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return {
    profile,
    driverData,
    loading,
    error,
    loadProfile,
    updateProfile,
    updateDriverData,
  };
};