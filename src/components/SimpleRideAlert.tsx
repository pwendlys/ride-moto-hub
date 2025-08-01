import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'

interface SimpleRideAlertProps {
  notificationId: string
  rideId: string
  onAccept: (notificationId: string, rideId: string) => Promise<{ success: boolean; error?: any }>
  onDecline: (notificationId: string) => void
  loading?: boolean
}

export const SimpleRideAlert: React.FC<SimpleRideAlertProps> = ({
  notificationId,
  rideId,
  onAccept,
  onDecline,
  loading = false
}) => {
  return (
    <Card className="w-full border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 shadow-lg animate-pulse">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-full">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Nova Corrida Disponível
              </h3>
              <p className="text-sm text-muted-foreground">
                Um passageiro está solicitando uma corrida
              </p>
            </div>
          </div>
          <Badge variant="default" className="bg-primary text-primary-foreground">
            Disponível
          </Badge>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onDecline(notificationId)}
            disabled={loading}
            className="flex-1"
          >
            Recusar
          </Button>
          <Button
            onClick={() => onAccept(notificationId, rideId)}
            disabled={loading}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {loading ? 'Aceitando...' : 'Aceitar Corrida'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}