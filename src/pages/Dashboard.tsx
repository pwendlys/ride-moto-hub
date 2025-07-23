import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Bike, 
  User, 
  MapPin, 
  Clock, 
  Star, 
  LogOut,
  Settings,
  History,
  Plus,
  CheckCircle,
  AlertCircle,
  XCircle
} from "lucide-react";

interface Profile {
  id: string;
  user_type: 'passenger' | 'driver' | 'admin';
  full_name: string;
  phone: string;
}

interface DriverData {
  id: string;
  cnh: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  vehicle_type: 'motorcycle' | 'car';
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rating: number;
  total_rides: number;
}

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load driver data if user is a driver
      if (profileData.user_type === 'driver') {
        const { data: driverDataResponse, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (driverError && driverError.code !== 'PGRST116') {
          throw driverError;
        }
        
        setDriverData(driverDataResponse);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-4 h-4 mr-1" />Aprovado</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-warning-foreground"><AlertCircle className="w-4 h-4 mr-1" />Pendente</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-4 h-4 mr-1" />Rejeitado</Badge>;
      case 'suspended':
        return <Badge variant="destructive"><XCircle className="w-4 h-4 mr-1" />Suspenso</Badge>;
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Bike className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Erro ao carregar perfil</CardTitle>
            <CardDescription>
              Não foi possível carregar seus dados. Tente novamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bike className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold">MotoHub</h1>
                <p className="text-sm text-muted-foreground">
                  {profile.user_type === 'driver' ? 'Painel do Motorista' : 'Painel do Passageiro'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Olá, {profile.full_name}! 👋
          </h2>
          <p className="text-muted-foreground">
            {profile.user_type === 'driver' 
              ? 'Gerencie suas corridas e ganhos'
              : 'Solicite suas corridas rapidamente'
            }
          </p>
        </div>

        {/* Driver Status Card */}
        {profile.user_type === 'driver' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Status do Motorista
              </CardTitle>
            </CardHeader>
            <CardContent>
              {driverData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status da Conta:</span>
                    {getStatusBadge(driverData.status)}
                  </div>

                  {driverData.status === 'pending' && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                      <p className="text-sm text-warning-foreground">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        Seu cadastro está sendo analisado. Aguarde até 24 horas para aprovação.
                      </p>
                    </div>
                  )}

                  {driverData.status === 'approved' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{driverData.total_rides}</div>
                        <div className="text-sm text-muted-foreground">Corridas</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                          {driverData.rating.toFixed(1)} <Star className="w-4 h-4 fill-current" />
                        </div>
                        <div className="text-sm text-muted-foreground">Avaliação</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {driverData.vehicle_brand} {driverData.vehicle_model}
                        </div>
                        <div className="text-sm text-muted-foreground">{driverData.vehicle_plate}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Complete seu cadastro de motorista para começar a trabalhar.
                  </p>
                  <Button className="mt-4" onClick={() => navigate("/auth?type=driver&mode=signup")}>
                    Completar Cadastro
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {profile.user_type === 'passenger' ? (
            <>
              <Card className="hover:shadow-glow transition-all duration-300 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Plus className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nova Corrida</h3>
                  <p className="text-muted-foreground">Solicitar uma nova corrida</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-glow transition-all duration-300 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <History className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Histórico</h3>
                  <p className="text-muted-foreground">Ver corridas anteriores</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-glow transition-all duration-300 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <MapPin className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Endereços</h3>
                  <p className="text-muted-foreground">Gerenciar endereços salvos</p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="hover:shadow-glow transition-all duration-300 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Clock className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ficar Online</h3>
                  <p className="text-muted-foreground">Receber solicitações de corrida</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-glow transition-all duration-300 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <History className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Histórico</h3>
                  <p className="text-muted-foreground">Ver corridas realizadas</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-glow transition-all duration-300 cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Star className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ganhos</h3>
                  <p className="text-muted-foreground">Ver relatório financeiro</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>
              Suas últimas interações no aplicativo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {profile.user_type === 'passenger' 
                  ? 'Você ainda não fez nenhuma corrida'
                  : 'Você ainda não realizou nenhuma corrida'
                }
              </p>
              <Button variant="outline" className="mt-4">
                {profile.user_type === 'passenger' 
                  ? 'Solicitar Primera Corrida'
                  : 'Ficar Online'
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;