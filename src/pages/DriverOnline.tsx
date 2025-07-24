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
import { RideNotificationWithTimer } from '@/components/RideNotificationWithTimer';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Clock, 
  Circle, 
  Navigation, 
  Car,
  ArrowLeft,
  Bell,
  BellOff
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
    rideQueue.startListening();
    return () => {
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

        {/* Pending Ride Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Corridas Disponíveis</h2>
            <div className="flex items-center gap-2">
              {rideQueue.isListening ? (
                <Bell className="w-5 h-5 text-success" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {rideQueue.isListening ? 'Escutando' : 'Desconectado'}
              </span>
            </div>
          </div>

          {rideQueue.activeNotifications.length > 0 ? (
            rideQueue.activeNotifications.map((notification) => (
              <RideNotificationWithTimer
                key={notification.id}
                notification={notification}
                onAccept={handleAcceptRide}
                onDecline={handleDeclineRide}
              />
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma corrida disponível no momento.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Fique atento às notificações de novas solicitações!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverOnline;