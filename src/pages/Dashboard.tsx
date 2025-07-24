import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useDriverRideNotifications } from "@/hooks/useRides";
import { RideNotification } from "@/components/RideNotification";
import { 
  Bike, 
  Car,
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
  XCircle,
  Shield,
  Users,
  DollarSign,
  BarChart3,
  TrendingUp,
  Check,
  X,
  Circle
} from "lucide-react";

interface Profile {
  id: string;
  user_type: 'passenger' | 'driver' | 'admin';
  full_name: string;
  phone: string;
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
}

interface DriverWithProfile extends DriverData {
  profile: {
    full_name: string;
    phone: string;
  };
}

interface SystemSettings {
  id: string;
  price_per_km: number;
  minimum_fare: number;
  app_fee_percentage: number;
  fixed_rate: number;
}

interface AdminStats {
  totalDrivers: number;
  pendingDrivers: number;
  totalRides: number;
  totalRevenue: number;
  totalPassengers: number;
}

interface PassengerData {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
  total_rides: number;
  total_spent: number;
}

interface AllDriverData extends DriverData {
  profile: {
    full_name: string;
    phone: string;
    created_at: string;
  };
}

interface DriverEarnings {
  driver_id: string;
  full_name: string;
  total_rides: number;
  total_earnings: number;
  average_rating: number;
  status: string;
}

interface RideData {
  id: string;
  passenger_name: string;
  driver_name: string;
  origin_address: string;
  destination_address: string;
  final_price: number;
  status: string;
  created_at: string;
  passenger_rating: number;
  driver_rating: number;
}

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  
  // Driver functionality hooks
  const driverLocation = useDriverLocation(false);
  const rideNotifications = useDriverRideNotifications();
  
  // Admin states
  const [pendingDrivers, setPendingDrivers] = useState<DriverWithProfile[]>([]);
  const [allDrivers, setAllDrivers] = useState<AllDriverData[]>([]);
  const [passengers, setPassengers] = useState<PassengerData[]>([]);
  const [driverEarnings, setDriverEarnings] = useState<DriverEarnings[]>([]);
  const [rides, setRides] = useState<RideData[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalDrivers: 0,
    pendingDrivers: 0,
    totalRides: 0,
    totalRevenue: 0,
    totalPassengers: 0
  });
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

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
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load driver data if user is a driver
      if (profileData && profileData.user_type === 'driver') {
        const { data: driverDataResponse, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', user?.id)
          .maybeSingle();

        if (driverError && driverError.code !== 'PGRST116') {
          throw driverError;
        }
        
        setDriverData(driverDataResponse);
      }

      // Load admin data if user is admin
      if (profileData && profileData.user_type === 'admin') {
        await loadAdminData();
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

  const loadAdminData = async () => {
    try {
      // Load pending drivers with their profiles
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*')
        .eq('status', 'pending');

      if (driversError) throw driversError;

      // Get profiles for each driver
      const driversWithProfiles = await Promise.all(
        driversData.map(async (driver) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('user_id', driver.user_id)
            .maybeSingle();

          return {
            ...driver,
            profile: profileData || { full_name: 'Nome não informado', phone: 'Telefone não informado' }
          };
        })
      );
      
      setPendingDrivers(driversWithProfiles);

      // Load all drivers
      await loadAllDrivers();
      
      // Load all passengers
      await loadAllPassengers();
      
      // Load driver earnings
      await loadDriverEarnings();
      
      // Load all rides
      await loadAllRides();

      // Load admin stats
      const [totalDriversRes, totalRidesRes, totalPassengersRes, settingsRes] = await Promise.all([
        supabase.from('drivers').select('id', { count: 'exact' }),
        supabase.from('rides').select('id, final_price', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('user_type', 'passenger'),
        supabase.from('system_settings').select('*').maybeSingle()
      ]);

      const stats = {
        totalDrivers: totalDriversRes.count || 0,
        pendingDrivers: driversData.length,
        totalRides: totalRidesRes.count || 0,
        totalRevenue: totalRidesRes.data?.reduce((sum, ride) => sum + (ride.final_price || 0), 0) || 0,
        totalPassengers: totalPassengersRes.count || 0
      };

      setAdminStats(stats);
      setSystemSettings(settingsRes.data);

    } catch (error: any) {
      console.error('Error loading admin data:', error);
    }
  };

  const loadAllDrivers = async () => {
    try {
      const { data: driversData, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const driversWithProfiles = await Promise.all(
        driversData.map(async (driver) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, phone, created_at')
            .eq('user_id', driver.user_id)
            .maybeSingle();

          return {
            ...driver,
            profile: profileData || { full_name: 'Nome não informado', phone: 'Telefone não informado', created_at: '' }
          };
        })
      );
      
      setAllDrivers(driversWithProfiles);
    } catch (error: any) {
      console.error('Error loading all drivers:', error);
    }
  };

  const loadAllPassengers = async () => {
    try {
      console.log('Loading passengers...');
      const { data: passengersData, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone, created_at')
        .eq('user_type', 'passenger')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching passengers:', error);
        throw error;
      }

      console.log('Passengers found:', passengersData);

      if (!passengersData || passengersData.length === 0) {
        console.log('No passengers found');
        setPassengers([]);
        return;
      }

      // Calculate ride stats for each passenger
      const passengersWithStats = await Promise.all(
        passengersData.map(async (passenger) => {
          const { data: ridesData, error: ridesError } = await supabase
            .from('rides')
            .select('final_price')
            .eq('passenger_id', passenger.user_id)
            .eq('status', 'completed');

          if (ridesError) {
            console.error('Error fetching rides for passenger:', passenger.user_id, ridesError);
          }

          const totalRides = ridesData?.length || 0;
          const totalSpent = ridesData?.reduce((sum, ride) => sum + (ride.final_price || 0), 0) || 0;

          return {
            id: passenger.id,
            full_name: passenger.full_name || 'Nome não informado',
            phone: passenger.phone || 'Telefone não informado',
            created_at: passenger.created_at,
            total_rides: totalRides,
            total_spent: totalSpent
          };
        })
      );
      
      console.log('Passengers with stats:', passengersWithStats);
      setPassengers(passengersWithStats);
    } catch (error: any) {
      console.error('Error loading passengers:', error);
    }
  };

  const loadDriverEarnings = async () => {
    try {
      const { data: driversData, error } = await supabase
        .from('drivers')
        .select('*');

      if (error) throw error;

      // Calculate earnings for each driver
      const earningsData = await Promise.all(
        driversData.map(async (driver) => {
          // Get driver profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', driver.user_id)
            .maybeSingle();

          // Get driver rides
          const { data: ridesData } = await supabase
            .from('rides')
            .select('final_price')
            .eq('driver_id', driver.user_id)
            .eq('status', 'completed');

          const totalEarnings = ridesData?.reduce((sum, ride) => sum + (ride.final_price || 0), 0) || 0;
          // Calculate driver earnings (assuming 80% goes to driver based on app_fee_percentage)
          const driverEarnings = totalEarnings * 0.8;

          return {
            driver_id: driver.id,
            full_name: profileData?.full_name || 'Nome não informado',
            total_rides: driver.total_rides || 0,
            total_earnings: driverEarnings,
            average_rating: driver.rating || 5.0,
            status: driver.status
          };
        })
      );
      
      setDriverEarnings(earningsData);
    } catch (error: any) {
      console.error('Error loading driver earnings:', error);
    }
  };

  const loadAllRides = async () => {
    try {
      const { data: ridesData, error } = await supabase
        .from('rides')
        .select(`
          id,
          passenger_id,
          driver_id,
          origin_address,
          destination_address,
          final_price,
          status,
          created_at,
          passenger_rating,
          driver_rating
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get passenger and driver names
      const ridesWithNames = await Promise.all(
        ridesData.map(async (ride) => {
          const [passengerRes, driverRes] = await Promise.all([
            supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', ride.passenger_id)
              .maybeSingle(),
            ride.driver_id ? supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', ride.driver_id)
              .maybeSingle() : Promise.resolve({ data: null })
          ]);

          return {
            ...ride,
            passenger_name: passengerRes.data?.full_name || 'Nome não informado',
            driver_name: driverRes.data?.full_name || 'Motorista não atribuído'
          };
        })
      );
      
      setRides(ridesWithNames);
    } catch (error: any) {
      console.error('Error loading rides:', error);
    }
  };

  const updateDriverStatus = async (driverId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: newStatus })
        .eq('id', driverId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Motorista ${newStatus === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso.`,
      });

      // Reload admin data
      loadAdminData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle driver going online/offline
  const handleToggleOnline = async () => {
    if (profile?.user_type !== 'driver' || !driverData || driverData.status !== 'approved') {
      toast({
        title: "Ação não permitida",
        description: "Apenas motoristas aprovados podem ficar online",
        variant: "destructive"
      });
      return;
    }

    if (!driverLocation.isOnline) {
      // Going online - navigate to driver online page
      navigate('/driver/online');
    } else {
      // Going offline
      await driverLocation.setOnlineStatus(false);
      rideNotifications.stopListening();
      toast({
        title: "Status atualizado",
        description: "Você está offline agora"
      });
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
                   {profile.user_type === 'admin' 
                     ? 'Painel Administrativo' 
                     : profile.user_type === 'driver' 
                       ? 'Painel do Motorista' 
                       : 'Painel do Passageiro'
                   }
                 </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
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
            {profile.user_type === 'admin' 
              ? 'Gerencie a plataforma MotoHub'
              : profile.user_type === 'driver' 
                ? 'Gerencie suas corridas e ganhos'
                : 'Solicite suas corridas rapidamente'
            }
          </p>
        </div>

        {/* Admin Dashboard */}
        {profile.user_type === 'admin' ? (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de Motoristas</p>
                      <p className="text-2xl font-bold">{adminStats.totalDrivers}</p>
                    </div>
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                      <p className="text-2xl font-bold text-warning">{adminStats.pendingDrivers}</p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-warning" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de Corridas</p>
                      <p className="text-2xl font-bold">{adminStats.totalRides}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

               <Card>
                 <CardContent className="p-6">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium text-muted-foreground">Total de Passageiros</p>
                       <p className="text-2xl font-bold">{adminStats.totalPassengers}</p>
                     </div>
                     <User className="w-8 h-8 text-primary" />
                   </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardContent className="p-6">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                       <p className="text-2xl font-bold">R$ {adminStats.totalRevenue.toFixed(2)}</p>
                     </div>
                     <DollarSign className="w-8 h-8 text-success" />
                   </div>
                 </CardContent>
               </Card>
            </div>

            {/* Admin Tabs */}
            <Tabs defaultValue="drivers" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="drivers">Aprovar Motoristas</TabsTrigger>
                <TabsTrigger value="passengers">Passageiros</TabsTrigger>
                <TabsTrigger value="all-drivers">Todos os Motoristas</TabsTrigger>
                <TabsTrigger value="earnings">Ganhos dos Motoristas</TabsTrigger>
                <TabsTrigger value="rides">Corridas Realizadas</TabsTrigger>
                <TabsTrigger value="settings">Configurações</TabsTrigger>
              </TabsList>

              {/* Pending Drivers Tab */}
              <TabsContent value="drivers" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Motoristas Pendentes de Aprovação
                    </CardTitle>
                    <CardDescription>
                      Analise e aprove os cadastros de novos motoristas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pendingDrivers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>CNH</TableHead>
                            <TableHead>Veículo</TableHead>
                            <TableHead>Placa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingDrivers.map((driver) => (
                            <TableRow key={driver.id}>
                              <TableCell className="font-medium">{driver.profile.full_name}</TableCell>
                              <TableCell>{driver.profile.phone}</TableCell>
                              <TableCell>{driver.cnh}</TableCell>
                              <TableCell>{driver.vehicle_brand} {driver.vehicle_model}</TableCell>
                              <TableCell>{driver.vehicle_plate}</TableCell>
                              <TableCell>{getStatusBadge(driver.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateDriverStatus(driver.id, 'approved')}
                                    className="bg-success hover:bg-success/90"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => updateDriverStatus(driver.id, 'rejected')}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rejeitar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Não há motoristas pendentes de aprovação
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Passengers Tab */}
              <TabsContent value="passengers" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Todos os Passageiros
                    </CardTitle>
                    <CardDescription>
                      Lista de todos os passageiros cadastrados na plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {passengers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Data de Cadastro</TableHead>
                            <TableHead>Total de Corridas</TableHead>
                            <TableHead>Valor Gasto Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {passengers.map((passenger) => (
                            <TableRow key={passenger.id}>
                              <TableCell className="font-medium">{passenger.full_name}</TableCell>
                              <TableCell>{passenger.phone}</TableCell>
                              <TableCell>{new Date(passenger.created_at).toLocaleDateString('pt-BR')}</TableCell>
                              <TableCell>{passenger.total_rides}</TableCell>
                              <TableCell>R$ {passenger.total_spent.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Nenhum passageiro cadastrado
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* All Drivers Tab */}
              <TabsContent value="all-drivers" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Todos os Motoristas
                    </CardTitle>
                    <CardDescription>
                      Lista completa de todos os motoristas da plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {allDrivers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>CNH</TableHead>
                            <TableHead>Veículo</TableHead>
                            <TableHead>Placa</TableHead>
                            <TableHead>Cor</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Total de Corridas</TableHead>
                            <TableHead>Avaliação</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data de Cadastro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allDrivers.map((driver) => (
                            <TableRow key={driver.id}>
                              <TableCell className="font-medium">{driver.profile.full_name}</TableCell>
                              <TableCell>{driver.profile.phone}</TableCell>
                              <TableCell>{driver.cnh}</TableCell>
                              <TableCell>{driver.vehicle_brand} {driver.vehicle_model}</TableCell>
                              <TableCell>{driver.vehicle_plate}</TableCell>
                              <TableCell>{driver.vehicle_color}</TableCell>
                              <TableCell className="capitalize">{driver.vehicle_type}</TableCell>
                              <TableCell>{driver.total_rides}</TableCell>
                              <TableCell className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-warning fill-current" />
                                {driver.rating.toFixed(1)}
                              </TableCell>
                              <TableCell>{getStatusBadge(driver.status)}</TableCell>
                              <TableCell>{new Date(driver.profile.created_at).toLocaleDateString('pt-BR')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Nenhum motorista cadastrado
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Driver Earnings Tab */}
              <TabsContent value="earnings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Ganhos dos Motoristas
                    </CardTitle>
                    <CardDescription>
                      Relatório de ganhos e transferências dos motoristas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {driverEarnings.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Motorista</TableHead>
                            <TableHead>Total de Corridas</TableHead>
                            <TableHead>Total de Ganhos</TableHead>
                            <TableHead>Ganho Médio por Corrida</TableHead>
                            <TableHead>Avaliação Média</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {driverEarnings.map((driver) => (
                            <TableRow key={driver.driver_id}>
                              <TableCell className="font-medium">{driver.full_name}</TableCell>
                              <TableCell>{driver.total_rides}</TableCell>
                              <TableCell>R$ {driver.total_earnings.toFixed(2)}</TableCell>
                              <TableCell>
                                R$ {driver.total_rides > 0 ? (driver.total_earnings / driver.total_rides).toFixed(2) : '0.00'}
                              </TableCell>
                              <TableCell className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-warning fill-current" />
                                {driver.average_rating.toFixed(1)}
                              </TableCell>
                              <TableCell>{getStatusBadge(driver.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Nenhum dado de ganhos disponível
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* All Rides Tab */}
              <TabsContent value="rides" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Corridas Realizadas
                    </CardTitle>
                    <CardDescription>
                      Histórico completo de todas as corridas da plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {rides.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Passageiro</TableHead>
                            <TableHead>Motorista</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Destino</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Avaliação Passageiro</TableHead>
                            <TableHead>Avaliação Motorista</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rides.map((ride) => (
                            <TableRow key={ride.id}>
                              <TableCell className="font-medium">{ride.passenger_name}</TableCell>
                              <TableCell>{ride.driver_name}</TableCell>
                              <TableCell className="max-w-32 truncate">{ride.origin_address}</TableCell>
                              <TableCell className="max-w-32 truncate">{ride.destination_address}</TableCell>
                              <TableCell>R$ {ride.final_price?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>
                                <Badge variant={ride.status === 'completed' ? 'default' : 'secondary'}>
                                  {ride.status === 'completed' ? 'Concluída' : 
                                   ride.status === 'cancelled' ? 'Cancelada' : 
                                   ride.status === 'in_progress' ? 'Em andamento' : ride.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {ride.passenger_rating ? (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 text-warning fill-current" />
                                    {ride.passenger_rating}
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {ride.driver_rating ? (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 text-warning fill-current" />
                                    {ride.driver_rating}
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>{new Date(ride.created_at).toLocaleDateString('pt-BR')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Nenhuma corrida registrada
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* System Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Configurações do Sistema
                    </CardTitle>
                    <CardDescription>
                      Gerencie preços e configurações da plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {systemSettings ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Preço por km</label>
                          <div className="text-lg font-semibold">R$ {systemSettings.price_per_km.toFixed(2)}</div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tarifa mínima</label>
                          <div className="text-lg font-semibold">R$ {systemSettings.minimum_fare.toFixed(2)}</div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Taxa do app (%)</label>
                          <div className="text-lg font-semibold">{systemSettings.app_fee_percentage.toFixed(2)}%</div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Taxa fixa</label>
                          <div className="text-lg font-semibold">R$ {systemSettings.fixed_rate.toFixed(2)}</div>
                        </div>
                        <div className="col-span-full">
                          <Button className="w-full">
                            <Settings className="w-4 h-4 mr-2" />
                            Editar Configurações
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Carregando configurações...
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Relatórios Administrativos
                    </CardTitle>
                    <CardDescription>
                      Visualize dados e métricas da plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Relatórios em desenvolvimento
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Em breve você poderá visualizar gráficos detalhados e relatórios financeiros
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <>
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
                  <Card 
                    className="hover:shadow-glow transition-all duration-300 cursor-pointer"
                    onClick={() => navigate('/ride/request')}
                  >
                    <CardContent className="p-6 text-center">
                      <Car className="w-12 h-12 text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Solicitar Corrida</h3>
                      <p className="text-muted-foreground">Encontre um motorista e solicite sua corrida</p>
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
                  <Card 
                    className="hover:shadow-glow transition-all duration-300 cursor-pointer"
                    onClick={handleToggleOnline}
                  >
                    <CardContent className="p-6 text-center">
                      <Clock className="w-12 h-12 text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        {driverLocation.isOnline ? 'Ficar Offline' : 'Ficar Online'}
                      </h3>
                      <p className="text-muted-foreground">
                        {driverLocation.isOnline ? 'Parar de receber corridas' : 'Receber solicitações de corrida'}
                      </p>
                      {driverLocation.isOnline && (
                        <Badge className="mt-2 bg-success text-success-foreground">
                          <Circle className="w-3 h-3 mr-1 fill-current" />
                          Online
                        </Badge>
                      )}
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

            {/* Driver Ride Notifications */}
            {profile.user_type === 'driver' && rideNotifications.pendingRides.length > 0 && (
              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-semibold">Corridas Disponíveis</h3>
                {rideNotifications.pendingRides.map((ride) => (
                  <RideNotification
                    key={ride.id}
                    ride={ride}
                    onAccept={async (rideId) => {
                      // Navigate to driver online page to handle ride acceptance
                      navigate('/driver/online');
                    }}
                    onDecline={(rideId) => {
                      rideNotifications.removePendingRide(rideId);
                    }}
                  />
                ))}
              </div>
            )}

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
                  <Button variant="outline" className="mt-4" onClick={() => {
                    if (profile.user_type === 'passenger') {
                      navigate('/ride/request')
                    } else {
                      handleToggleOnline()
                    }
                  }}>
                    {profile.user_type === 'passenger' 
                      ? 'Solicitar Primeira Corrida'
                      : driverLocation.isOnline ? 'Ficar Offline' : 'Ficar Online'
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;