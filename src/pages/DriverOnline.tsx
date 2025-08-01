
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useRideQueue } from '@/hooks/useRideQueue';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoogleMap } from '@/components/maps/GoogleMap';

import { RideQueueStatus } from '@/components/RideQueueStatus';
import { MinimalRidesList } from '@/components/MinimalRidesList';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Clock, 
  Circle, 
  Navigation, 
  Car,
  ArrowLeft,
  Bell,
  BellOff,
  RefreshCw
} from 'lucide-react';

const DriverOnline = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Hooks
  const currentLocation = useGeolocation(true, 10000);
  const driverLocation = useDriverLocation(true);
  const rideQueue = useRideQueue();

  // Start listening for rides when component mounts
  useEffect(() => {
    console.log('🔔 DriverOnline: Iniciando listener de corridas...')
    rideQueue.startListening();
    return () => {
      console.log('🔔 DriverOnline: Parando listener de corridas...')
      rideQueue.stopListening();
    };
  }, []);

  // Set driver online when location is available
  useEffect(() => {
    if (currentLocation.coords && !driverLocation.isOnline) {
      driverLocation.setOnlineStatus(true);
      toast({
        title: "Você está online!",
        description: "Aguardando solicitações de corrida...",
      });
    }
  }, [currentLocation.coords]);

  const handleGoOffline = async () => {
    await driverLocation.setOnlineStatus(false);
    rideQueue.stopListening();
    toast({
      title: "Você está offline",
      description: "Voltando ao dashboard...",
    });
    navigate('/dashboard');
  };

  const handleAcceptRide = async (notificationId: string, rideId: string) => {
    const result = await rideQueue.acceptNotification(notificationId, rideId);
    if (result.success) {
      navigate(`/active-ride/${rideId}`);
    }
    return result;
  };

  const handleDeclineRide = (notificationId: string) => {
    rideQueue.declineNotification(notificationId);
  };

  const handleRefreshRides = () => {
    rideQueue.refreshNotifications();
    toast({
      title: "Atualizando...",
      description: "Buscando corridas disponíveis",
      duration: 2000
    });
  };

  if (currentLocation.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Navigation className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Obtendo sua localização...</p>
        </div>
      </div>
    );
  }

  if (currentLocation.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Erro de Localização</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <MapPin className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Não foi possível obter sua localização. É necessário permitir o acesso à localização para funcionar como motorista.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Motorista Online</h1>
                <p className="text-sm text-muted-foreground">
                  Aguardando solicitações de corrida
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge className="bg-success text-success-foreground">
                <Circle className="w-3 h-3 mr-1 fill-current animate-pulse" />
                Online
              </Badge>
              <Button variant="destructive" size="sm" onClick={handleGoOffline}>
                Ficar Offline
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Current Location Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Sua Localização Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-lg font-semibold text-primary">
                  {driverLocation.location.accuracy ? `±${driverLocation.location.accuracy.toFixed(0)}m` : 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">Precisão</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-lg font-semibold text-success">
                  {driverLocation.isOnline ? 'Ativo' : 'Inativo'}
                </div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-lg font-semibold text-primary">
                  {rideQueue.activeNotifications.length}
                </div>
                <div className="text-sm text-muted-foreground">Corridas Pendentes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Status */}
        <RideQueueStatus />

        {/* Map */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Mapa de Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {currentLocation.coords && (
              <GoogleMap
                center={currentLocation.coords}
                zoom={16}
                height="400px"
                className="w-full rounded-b-lg"
                markers={[
                  {
                    position: currentLocation.coords,
                    title: 'Sua localização',
                    icon: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="20" cy="20" r="15" fill="#22c55e" stroke="#fff" stroke-width="3"/>
                        <circle cx="20" cy="20" r="5" fill="#fff"/>
                      </svg>
                    `)
                  }
                ]}
                onMapLoad={(mapInstance) => {
                  setMap(mapInstance);
                  setMapLoaded(true);
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Available Rides Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Corridas Disponíveis</h2>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshRides}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
              <div className="flex items-center gap-2">
                {rideQueue.isListening ? (
                  <Bell className="w-5 h-5 text-success" />
                ) : (
                  <BellOff className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {rideQueue.isListening ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>

          <MinimalRidesList
            notifications={rideQueue.activeNotifications}
            onAccept={handleAcceptRide}
            onDecline={handleDeclineRide}
            isListening={rideQueue.isListening}
          />

          {process.env.NODE_ENV === 'development' && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Debug Info</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>🔔 Listener: {rideQueue.isListening ? '✅ Ativo' : '❌ Inativo'}</div>
                <div>👤 User ID: {user?.id}</div>
                <div>🌐 Online: {driverLocation.isOnline ? '✅' : '❌'}</div>
                <div>📍 Coords: {currentLocation.coords ? `${currentLocation.coords.lat.toFixed(6)}, ${currentLocation.coords.lng.toFixed(6)}` : 'N/A'}</div>
                <div>📨 Notifications: {rideQueue.activeNotifications.length}</div>
                <div>⏰ Timestamp: {new Date().toLocaleTimeString()}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverOnline;
