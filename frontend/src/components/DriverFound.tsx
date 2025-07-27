import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, User, Phone, Car, MapPin } from 'lucide-react'

interface DriverFoundProps {
  driver: {
    full_name: string
    phone: string
    vehicle_brand: string
    vehicle_model: string
    vehicle_color: string
    vehicle_plate: string
  }
  ride: {
    origin_address: string
    destination_address: string
    estimated_price?: number
  }
  onContinue: () => void
}

export const DriverFound: React.FC<DriverFoundProps> = ({
  driver,
  ride,
  onContinue
}) => {
  const formatPrice = (price?: number) => {
    if (!price) return 'A calcular'
    return `R$ ${price.toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-xl text-green-700">Motorista Encontrado!</CardTitle>
          <p className="text-muted-foreground">
            Seu motorista está a caminho
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Driver Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-center">Detalhes do Motorista</h3>
            
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <User className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium">{driver.full_name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {driver.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Car className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium">
                  {driver.vehicle_brand} {driver.vehicle_model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {driver.vehicle_color} • {driver.vehicle_plate}
                </p>
              </div>
            </div>
          </div>

          {/* Trip Summary */}
          <div className="space-y-3">
            <h3 className="font-semibold text-center">Resumo da Viagem</h3>
            
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

            <div className="text-center p-3 bg-primary/10 rounded-lg">
              <p className="text-lg font-semibold text-primary">
                {formatPrice(ride.estimated_price)}
              </p>
              <p className="text-sm text-muted-foreground">Valor estimado</p>
            </div>
          </div>

          {/* Status */}
          <div className="text-center">
            <Badge className="bg-green-500 text-white px-4 py-2">
              Motorista a caminho
            </Badge>
          </div>

          {/* Continue Button */}
          <Button onClick={onContinue} className="w-full">
            Continuar para Acompanhamento
          </Button>

          {/* Tips */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>📱 O motorista entrará em contato em breve</p>
            <p>🕐 Fique atento ao horário estimado de chegada</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}