import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RideNotification } from '@/hooks/useRideQueue'
import { Clock, MapPin, User, DollarSign, Phone } from 'lucide-react'

interface AvailableRidesListProps {
  notifications: RideNotification[]
  onAccept: (notificationId: string, rideId: string) => Promise<{ success: boolean; error?: any }>
  onDecline: (notificationId: string) => void
  isListening: boolean
}

export const AvailableRidesList = ({ 
  notifications, 
  onAccept, 
  onDecline, 
  isListening 
}: AvailableRidesListProps) => {

  const formatPrice = (price?: number) => {
    if (!price) return 'A calcular'
    return `R$ ${price.toFixed(2)}`
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()
    const seconds = Math.max(0, Math.floor(diff / 1000))
    return seconds
  }

  if (!isListening) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <div className="text-destructive mb-2">⚠️ Sistema Offline</div>
          <p className="text-sm text-muted-foreground mb-4">
            O sistema de notificações está desconectado. Verifique sua conexão com a internet.
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            size="sm"
          >
            🔄 Reconectar Sistema
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground mb-2">🚗</div>
          <p className="text-muted-foreground">
            Nenhuma corrida disponível no momento
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Aguarde novas solicitações de passageiros
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => {
        const timeRemaining = getTimeRemaining(notification.expires_at)
        const isExpiringSoon = timeRemaining <= 30

        return (
          <Card 
            key={notification.id} 
            className={`${isExpiringSoon ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-primary/20'} transition-all duration-300`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Nova Corrida
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={isExpiringSoon ? "destructive" : "secondary"}>
                    <Clock className="w-3 h-3 mr-1" />
                    {timeRemaining}s
                  </Badge>
                  <Badge variant="outline">
                    #{notification.position_in_queue}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Informações da Corrida */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-success mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Origem</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.ride?.origin_address || 'Endereço não disponível'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-destructive mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Destino</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.ride?.destination_address || 'Endereço não disponível'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações do Passageiro e Preço */}
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {notification.ride?.passenger.full_name || 'Passageiro'}
                    </p>
                    {notification.ride?.passenger.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {notification.ride.passenger.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-bold text-primary">
                    <DollarSign className="w-4 h-4" />
                    {formatPrice(notification.ride?.estimated_price)}
                  </div>
                  {notification.distance_km && (
                    <p className="text-xs text-muted-foreground">
                      ~{notification.distance_km.toFixed(1)} km
                    </p>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onDecline(notification.id)}
                >
                  Recusar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={() => onAccept(notification.id, notification.ride_id)}
                >
                  Aceitar Corrida
                </Button>
              </div>

              {isExpiringSoon && (
                <div className="text-center text-sm text-orange-600 font-medium">
                  ⚠️ Esta corrida expira em breve!
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}