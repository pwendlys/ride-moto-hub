import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SimpleRideAlert } from '@/components/SimpleRideAlert'

interface MinimalRidesListProps {
  notifications: Array<{
    id: string
    ride_id: string
  }>
  onAccept: (notificationId: string, rideId: string) => Promise<{ success: boolean; error?: any }>
  onDecline: (notificationId: string) => void
  isListening: boolean
}

export const MinimalRidesList = ({ 
  notifications, 
  onAccept, 
  onDecline, 
  isListening 
}: MinimalRidesListProps) => {
  
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
      {notifications.map((notification) => (
        <SimpleRideAlert
          key={notification.id}
          notificationId={notification.id}
          rideId={notification.ride_id}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      ))}
    </div>
  )
}