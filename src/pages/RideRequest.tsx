import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Car, Clock, MapPin, DollarSign } from 'lucide-react'
import { MapSelector } from '@/components/maps/MapSelector'
import { useRides } from '@/hooks/useRides'
import { useAuth } from '@/hooks/useAuth'
import { WaitingForDriver } from '@/components/WaitingForDriver'
import { DriverFound } from '@/components/DriverFound'
import { toast } from 'sonner'

interface LocationSelection {
  coords: { lat: number; lng: number }
  address: string
  type: 'current' | 'selected' | 'searched'
}

interface RouteInfo {
  origin: LocationSelection
  destination: LocationSelection
  distance: number
  duration: number
  price: number
  driverEarnings: number
  appFee: number
  priceBreakdown: {
    basePrice: number
    distancePrice: number
    minimumFare: number
    pricingModel: string
  }
}

export default function RideRequest() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { createRide } = useRides()
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)

  const handleRouteCalculated = (route: RouteInfo) => {
    setRouteInfo(route)
  }

  const handleRequestRide = async () => {
    if (!routeInfo) {
      toast.error('Informações incompletas para solicitar corrida')
      return
    }

    setIsRequesting(true)
    try {
      const data = await createRide({
        origin: routeInfo.origin.coords,
        destination: routeInfo.destination.coords,
        origin_address: routeInfo.origin.address,
        destination_address: routeInfo.destination.address,
        distance_km: routeInfo.distance,
        estimated_duration_minutes: Math.round(routeInfo.duration),
        estimated_price: routeInfo.price,
      })

      toast.success('Corrida solicitada com sucesso!')
      navigate(`/ride/${data.id}`)
    } catch (error) {
      console.error('Erro ao solicitar corrida:', error)
      toast.error('Erro ao solicitar corrida')
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Solicitar Corrida</h1>
            <p className="text-muted-foreground">
              Selecione origem, destino e solicite sua corrida
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Map Selection */}
          <div className="lg:col-span-2">
            <MapSelector onRouteCalculated={handleRouteCalculated} />
          </div>

          {/* Route Summary */}
          {routeInfo && (
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Resumo da Corrida
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Route Details */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                          <div>
                            <Badge variant="secondary" className="mb-1">
                              Origem
                            </Badge>
                            <p className="text-sm">{routeInfo.origin.address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5"></div>
                          <div>
                            <Badge variant="secondary" className="mb-1">
                              Destino
                            </Badge>
                            <p className="text-sm">{routeInfo.destination.address}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <MapPin className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Distância</p>
                          <p className="font-semibold">{routeInfo.distance.toFixed(1)} km</p>
                        </div>
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Tempo</p>
                          <p className="font-semibold">{Math.round(routeInfo.duration)} min</p>
                        </div>
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Preço Total</p>
                          <p className="font-semibold">R$ {routeInfo.price.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
                      <h4 className="text-sm font-medium mb-2">Detalhamento do Preço</h4>
                      <div className="space-y-1 text-xs">
                        {routeInfo.priceBreakdown.pricingModel === 'per_km' ? (
                          <>
                            <div className="flex justify-between">
                              <span>Taxa base:</span>
                              <span>R$ {routeInfo.priceBreakdown.basePrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Distância ({routeInfo.distance.toFixed(1)} km):</span>
                              <span>R$ {routeInfo.priceBreakdown.distancePrice.toFixed(2)}</span>
                            </div>
                            {routeInfo.price === routeInfo.priceBreakdown.minimumFare && (
                              <div className="flex justify-between text-primary">
                                <span>Tarifa mínima aplicada:</span>
                                <span>R$ {routeInfo.priceBreakdown.minimumFare.toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex justify-between">
                            <span>Preço fixo:</span>
                            <span>R$ {routeInfo.priceBreakdown.basePrice.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t pt-1 mt-2">
                          <div className="flex justify-between font-medium text-primary">
                            <span>Valor total a pagar:</span>
                            <span>R$ {routeInfo.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  {/* Action Button */}
                  <div className="pt-4">
                    <Button
                      onClick={handleRequestRide}
                      disabled={isRequesting || !routeInfo}
                      className="w-full"
                      size="lg"
                    >
                      {isRequesting ? 'Solicitando...' : 'Confirmar e Solicitar Corrida'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}