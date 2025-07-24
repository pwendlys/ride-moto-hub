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
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No settings found, create default
          const defaultSettings = {
            fixed_rate: 5.0,
            price_per_km: 2.5,
            minimum_fare: 8.0,
            app_fee_percentage: 20.0,
            pricing_model: 'per_km',
            fee_type: 'percentage',
          };

          const { data: newSettings, error: insertError } = await supabase
            .from('system_settings')
            .insert(defaultSettings)
            .select()
            .single();

          if (insertError) throw insertError;
          setSettings(newSettings);
        } else {
          throw fetchError;
        }
      } else {
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    refetch,
  };
};