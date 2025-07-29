import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MapPin, User, DollarSign, Clock, Timer } from 'lucide-react'
import { RideNotification } from '@/hooks/useRideQueue'

interface RideNotificationWithTimerProps {
  notification: RideNotification
  onAccept: (notificationId: string, rideId: string) => Promise<{ success: boolean }>
  onDecline: (notificationId: string) => void
  loading?: boolean
}

export const RideNotificationWithTimer: React.FC<RideNotificationWithTimerProps> = ({
  notification,
  onAccept,
  onDecline,
  loading = false
}) => {
  const [timeLeft, setTimeLeft] = useState(0)
  const [progress, setProgress] = useState(100)
  const [isExpired, setIsExpired] = useState(false)

  // Calculate time remaining
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const expiresAt = new Date(notification.expires_at).getTime()
      const remaining = Math.max(0, expiresAt - now)
      
      setTimeLeft(remaining)
      setProgress((remaining / 50000) * 100) // 50 seconds total
      setIsExpired(remaining === 0)
      
      if (remaining === 0) {
        onDecline(notification.id)
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 100)

    return () => clearInterval(interval)
  }, [notification.expires_at, notification.id, onDecline])

  const formatTimeLeft = (ms: number) => {
    const seconds = Math.ceil(ms / 1000)
    return `${seconds}s`
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'A calcular'
    return `R$ ${price.toFixed(2)}`
  }

  const formatDistance = (distance?: number) => {
    if (!distance) return 'N/A'
    return `${distance.toFixed(1)} km`
  }

  if (isExpired) {
    return null
  }

  return (
    <Card className="w-full max-w-md mx-auto border-primary/20 shadow-lg animate-in slide-in-from-bottom-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Nova Corrida
            <Badge variant="outline" className="ml-2">
              📢 Broadcast
            </Badge>
          </CardTitle>
          <Badge variant="default" className="bg-green-500">
            Disponível
          </Badge>
        </div>
        
        {/* Timer Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm">
              <Timer className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-orange-500">
                {formatTimeLeft(timeLeft)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Distância: {formatDistance(notification.distance_km)}
            </span>
          </div>
          <Progress 
            value={progress} 
            className="h-2"
            style={{
              background: `linear-gradient(to right, 
                ${progress > 60 ? '#22c55e' : progress > 30 ? '#f59e0b' : '#ef4444'} 0%, 
                ${progress > 60 ? '#22c55e' : progress > 30 ? '#f59e0b' : '#ef4444'} ${progress}%, 
                #e5e7eb ${progress}%, 
                #e5e7eb 100%)`
            }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Passenger Info */}
        {notification.ride?.passenger && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{notification.ride.passenger.full_name}</p>
              <p className="text-sm text-muted-foreground">{notification.ride.passenger.phone}</p>
            </div>
          </div>
        )}

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
                <p className="text-sm text-muted-foreground">{notification.ride?.origin_address}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-red-700">Destino</p>
                <p className="text-sm text-muted-foreground">{notification.ride?.destination_address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="flex justify-center items-center p-2 bg-muted rounded-lg">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-600">
              {formatPrice(notification.ride?.estimated_price)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onDecline(notification.id)}
            disabled={loading}
            className="flex-1"
          >
            Recusar
          </Button>
          <Button
            onClick={() => onAccept(notification.id, notification.ride_id)}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Aceitando...' : 'Aceitar'}
          </Button>
        </div>

        {/* Time since request */}
        <p className="text-xs text-muted-foreground text-center">
          Notificado há {Math.floor((Date.now() - new Date(notification.notified_at).getTime()) / 1000)}s
        </p>
      </CardContent>
    </Card>
  )
}