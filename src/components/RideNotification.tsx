import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, User, DollarSign, Clock } from 'lucide-react'
import { RideWithPassenger } from '@/hooks/useRides'

interface RideNotificationProps {
  ride: RideWithPassenger
  onAccept: (rideId: string) => void
  onDecline: (rideId: string) => void
  loading?: boolean
}

export const RideNotification: React.FC<RideNotificationProps> = ({
  ride,
  onAccept,
  onDecline,
  loading = false
}) => {
  const formatPrice = (price?: number) => {
    if (!price) return 'A calcular'
    return `R$ ${price.toFixed(2)}`
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return 'A calcular'
    return `${duration} min`
  }

  return (
    <Card className="w-full max-w-md mx-auto border-primary/20 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Nova Corrida
          </CardTitle>
          <Badge variant="default" className="bg-green-500">
            Disponível
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Passenger Info */}
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{ride.passenger.full_name}</p>
            <p className="text-sm text-muted-foreground">{ride.passenger.phone}</p>
          </div>
        </div>

        {/* Route Info */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex flex-col items-center mt-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="w-0.5 h-6 bg-gray-300"></div>
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium text-green-700">Origem</p>
                <p className="text-sm text-muted-foreground">{ride.origin_address}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-red-700">Destino</p>
                <p className="text-sm text-muted-foreground">{ride.destination_address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="flex justify-between items-center p-2 bg-muted rounded-lg">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-600">
              {formatPrice(ride.estimated_price)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-600">
              {formatDuration(ride.estimated_duration_minutes)}
            </span>
          </div>
          {ride.distance_km && (
            <div className="text-sm font-medium">
              {ride.distance_km.toFixed(1)} km
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onDecline(ride.id)}
            disabled={loading}
            className="flex-1"
          >
            Recusar
          </Button>
          <Button
            onClick={() => onAccept(ride.id)}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Aceitando...' : 'Aceitar'}
          </Button>
        </div>

        {/* Time since request */}
        <p className="text-xs text-muted-foreground text-center">
          Solicitada há {new Date(Date.now() - new Date(ride.requested_at).getTime()).getMinutes() || 0} minutos
        </p>
      </CardContent>
    </Card>
  )
}