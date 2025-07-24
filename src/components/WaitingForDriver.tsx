import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { Car, Clock, MapPin, User, Phone } from 'lucide-react'

interface WaitingForDriverProps {
  rideId: string
  onRideAccepted: (ride: any) => void
  onCancel: () => void
}

export const WaitingForDriver: React.FC<WaitingForDriverProps> = ({
  rideId,
  onRideAccepted,
  onCancel
}) => {
  const [searchTime, setSearchTime] = useState(0)
  const [driversNotified, setDriversNotified] = useState(0)

  useEffect(() => {
    // Timer para tempo de busca
    const timer = setInterval(() => {
      setSearchTime(prev => prev + 1)
    }, 1000)

    // Subscribe to ride updates
    const channel = supabase
      .channel('waiting-for-driver')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`
        },
        async (payload) => {
          const updatedRide = payload.new
          
          if (updatedRide.status === 'accepted' && updatedRide.driver_id) {
            // Buscar dados do motorista
            const { data: driverProfile } = await supabase
              .from('profiles')
              .select('full_name, phone')
              .eq('user_id', updatedRide.driver_id)
              .single()

            const { data: driverData } = await supabase
              .from('drivers')
              .select('vehicle_brand, vehicle_model, vehicle_color, vehicle_plate')
              .eq('user_id', updatedRide.driver_id)
              .single()

            onRideAccepted({
              ...updatedRide,
              driver: {
                ...driverProfile,
                ...driverData
              }
            })
          }
        }
      )
      .subscribe()

    // Subscribe to notifications count
    const notificationChannel = supabase
      .channel('notification-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_notifications',
          filter: `ride_id=eq.${rideId}`
        },
        (payload) => {
          // Contar quantos motoristas foram notificados
          loadNotificationCount()
        }
      )
      .subscribe()

    const loadNotificationCount = async () => {
      const { count } = await supabase
        .from('ride_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('ride_id', rideId)
      
      setDriversNotified(count || 0)
    }

    loadNotificationCount()

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
      supabase.removeChannel(notificationChannel)
    }
  }, [rideId, onRideAccepted])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleCancel = async () => {
    try {
      await supabase
        .from('rides')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', rideId)
      
      onCancel()
    } catch (error) {
      console.error('Error cancelling ride:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Car className="w-16 h-16 text-primary animate-bounce" />
          </div>
          <CardTitle className="text-xl">Procurando Motorista</CardTitle>
          <p className="text-muted-foreground">
            Aguarde enquanto encontramos um motorista próximo para você
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status de busca */}
          <div className="text-center space-y-2">
            <Badge variant="outline" className="text-base px-4 py-2">
              <Clock className="w-4 h-4 mr-2" />
              {formatTime(searchTime)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Tempo de busca
            </p>
          </div>

          {/* Progresso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Motoristas notificados:</span>
              <Badge variant="secondary">{driversNotified}</Badge>
            </div>
            
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((driversNotified / 5) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Mensagens de status */}
          <div className="text-center space-y-2">
            {searchTime < 30 && (
              <p className="text-sm text-muted-foreground">
                🔍 Procurando motoristas próximos...
              </p>
            )}
            {searchTime >= 30 && searchTime < 60 && (
              <p className="text-sm text-muted-foreground">
                ⏳ Expandindo área de busca...
              </p>
            )}
            {searchTime >= 60 && (
              <p className="text-sm text-muted-foreground">
                🚗 Tentando encontrar motoristas disponíveis...
              </p>
            )}
          </div>

          {/* Botão cancelar */}
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="w-full"
          >
            Cancelar Corrida
          </Button>

          {/* Dicas */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>💡 Dica: Horários de pico podem demorar mais</p>
            <p>📱 Você receberá uma notificação quando um motorista aceitar</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}