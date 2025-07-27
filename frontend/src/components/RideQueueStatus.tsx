import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRideQueue } from '@/hooks/useRideQueue'

export const RideQueueStatus = () => {
  const { isListening, activeNotifications } = useRideQueue()

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          Sistema de Notificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={isListening ? "default" : "secondary"}>
            {isListening ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Corridas pendentes:</span>
          <Badge variant="outline">
            {activeNotifications.length}
          </Badge>
        </div>

        {isListening && (
          <div className="text-xs text-green-600 text-center pt-2">
            ✅ Pronto para receber corridas
          </div>
        )}

        {!isListening && (
          <div className="text-xs text-red-600 text-center pt-2">
            ❌ Sistema offline - verifique sua conexão
          </div>
        )}
      </CardContent>
    </Card>
  )
}