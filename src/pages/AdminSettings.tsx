import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { systemSettingsSchema, validateData } from '@/lib/validations';
import { AlertTriangle, Save, Shield, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminSettings() {
  const { user } = useAuth();
  const { settings, loading: settingsLoading, refetch } = useSystemSettings();
  const { logAction } = useAuditLog();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    fixed_rate: 5.0,
    price_per_km: 2.5,
    minimum_fare: 8.0,
    app_fee_percentage: 20.0,
    pricing_model: 'per_km' as 'per_km' | 'fixed',
    fee_type: 'percentage' as 'percentage' | 'fixed_amount',
  });

  // Check if user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('user_id', user.id)
          .single();

        if (error || profile?.user_type !== 'admin') {
          toast({
            title: "Acesso Negado",
            description: "Você não tem permissão para acessar esta página.",
            variant: "destructive",
          });
          navigate('/dashboard');
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error('Error checking admin role:', error);
        navigate('/dashboard');
      }
    };

    checkAdminRole();
  }, [user, navigate, toast]);

  // Load current settings
  useEffect(() => {
    if (settings) {
      setFormData({
        fixed_rate: settings.fixed_rate,
        price_per_km: settings.price_per_km,
        minimum_fare: settings.minimum_fare,
        app_fee_percentage: settings.app_fee_percentage,
        pricing_model: settings.pricing_model as 'per_km' | 'fixed',
        fee_type: settings.fee_type as 'percentage' | 'fixed_amount',
      });
    }
  }, [settings]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSave = async () => {
    if (!isAdmin || !user) {
      toast({
        title: "Erro de Autorização",
        description: "Você não tem permissão para fazer alterações.",
        variant: "destructive",
      });
      return;
    }

    // Validate input data
    const validation = validateData(systemSettingsSchema, formData);
    if (!validation.success) {
      toast({
        title: "Dados Inválidos",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Store old values for audit log
      const oldValues = settings ? { ...settings } : null;

      const { error } = await supabase
        .from('system_settings')
        .update(formData)
        .eq('id', settings?.id);

      if (error) throw error;

      // Log the admin action
      await logAction(
        'UPDATE_SYSTEM_SETTINGS',
        'system_settings',
        settings?.id,
        oldValues,
        formData
      );

      toast({
        title: "Configurações Atualizadas",
        description: "As configurações do sistema foram salvas com sucesso.",
      });

      refetch();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível atualizar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Verificando permissões de administrador...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground">Gerencie preços e configurações da plataforma</p>
        </div>
      </div>

      <Alert className="mb-6 border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Atenção:</strong> Alterações nas configurações afetam todos os usuários da plataforma. 
          Use com cuidado e verifique os valores antes de salvar.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Pricing Model */}
        <Card>
          <CardHeader>
            <CardTitle>Modelo de Precificação</CardTitle>
            <CardDescription>
              Escolha como os preços das corridas são calculados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pricing_model">Modelo de Preço</Label>
              <Select
                value={formData.pricing_model}
                onValueChange={(value) => handleInputChange('pricing_model', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_km">Por Quilômetro</SelectItem>
                  <SelectItem value="fixed">Valor Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração de Preços</CardTitle>
            <CardDescription>
              Defina os valores base para cálculo das corridas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fixed_rate">Taxa Fixa (R$)</Label>
                <Input
                  id="fixed_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  value={formData.fixed_rate}
                  onChange={(e) => handleInputChange('fixed_rate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="price_per_km">Preço por KM (R$)</Label>
                <Input
                  id="price_per_km"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.price_per_km}
                  onChange={(e) => handleInputChange('price_per_km', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="minimum_fare">Tarifa Mínima (R$)</Label>
                <Input
                  id="minimum_fare"
                  type="number"
                  step="0.01"
                  min="0"
                  max="500"
                  value={formData.minimum_fare}
                  onChange={(e) => handleInputChange('minimum_fare', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="app_fee_percentage">Taxa do App (%)</Label>
                <Input
                  id="app_fee_percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  value={formData.app_fee_percentage}
                  onChange={(e) => handleInputChange('app_fee_percentage', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração de Taxa</CardTitle>
            <CardDescription>
              Configure como a taxa da plataforma é aplicada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="fee_type">Tipo de Taxa</Label>
              <Select
                value={formData.fee_type}
                onValueChange={(value) => handleInputChange('fee_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual</SelectItem>
                  <SelectItem value="fixed_amount">Valor Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Card>
          <CardContent className="pt-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  className="w-full" 
                  disabled={isLoading || settingsLoading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Alterações</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja salvar essas configurações? 
                    Estas mudanças afetarão todos os cálculos de preço na plataforma.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSave}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}