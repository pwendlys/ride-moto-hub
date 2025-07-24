import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemSettings {
  id: string;
  fixed_rate: number;
  price_per_km: number;
  minimum_fare: number;
  app_fee_percentage: number;
  pricing_model: string;
  fee_type: string;
  created_at: string;
  updated_at: string;
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setSettings(data);
      } else {
        // Usar configurações padrão como fallback se não houver no banco
        const defaultSettings: SystemSettings = {
          id: 'default',
          fixed_rate: 5.0,
          price_per_km: 2.5,
          minimum_fare: 8.0,
          app_fee_percentage: 20.0,
          pricing_model: 'per_km',
          fee_type: 'percentage',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setSettings(defaultSettings);
        console.warn('Usando configurações padrão - nenhuma configuração encontrada no banco');
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
      
      // Usar configurações padrão em caso de erro
      const defaultSettings: SystemSettings = {
        id: 'default',
        fixed_rate: 5.0,
        price_per_km: 2.5,
        minimum_fare: 8.0,
        app_fee_percentage: 20.0,
        pricing_model: 'per_km',
        fee_type: 'percentage',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setSettings(defaultSettings);
      setError('Usando configurações padrão - erro ao carregar do servidor');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchSettings();
  };

  useEffect(() => {
    fetchSettings();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_settings'
      }, (payload) => {
        console.log('System settings changed:', payload);
        fetchSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    settings,
    loading,
    error,
    refetch,
  };
};