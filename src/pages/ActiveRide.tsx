import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GoogleMap } from '@/components/maps/GoogleMap'
import { useGeolocation, LocationCoords } from '@/hooks/useGeolocation'
import { useRides, RideWithPassenger } from '@/hooks/useRides'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  Phone, 
  User, 
  Clock,
  DollarSign,
  CheckCircle
} from 'lucide-react'

export default function ActiveRide() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { coords: currentLocation, loading: locationLoading } = useGeolocation(true)
  const { rides, updateRideStatus, loading } = useRides()
  const { toast } = useToast()
  
  const [ride, setRide] = useState<RideWithPassenger | null>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distance?: string
    duration?: string
  }>({})

  useEffect(() => {
    const currentRide = rides.find(r => r.id === id)
    if (currentRide) {
      setRide(currentRide)
    } else if (!loading && rides.length > 0) {
      // Ride not found, redirect to dashboard
      navigate('/dashboard')
    }
  }, [rides, id, loading, navigate])

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'accepted':
        return { 
          label: 'Aceita - Indo buscar', 
          color: 'bg-blue-500',
          action: 'Cheguei ao local',
          nextStatus: 'driver_arrived'
        }
      case 'driver_arriving':
        return { 
          label: 'A caminho do passageiro', 
          color: 'bg-yellow-500',
          action: 'Cheguei ao local',
          nextStatus: 'driver_arrived'
        }
      case 'driver_arrived':
        return { 
          label: 'No local de embarque', 
          color: 'bg-orange-500',
          action: 'Iniciar corrida',
          nextStatus: 'in_progress'
        }
      case 'in_progress':
        return { 
          label: 'Corrida em andamento', 
          color: 'bg-green-500',
          action: 'Finalizar corrida',
          nextStatus: 'completed'
        }
      case 'completed':
        return { 
          label: 'Corrida finalizada', 
          color: 'bg-gray-500',
          action: null,
          nextStatus: null
        }
      default:
        return { 
          label: 'Status desconhecido', 
          color: 'bg-gray-500',
          action: null,
          nextStatus: null
        }
    }
  }

  const handleStatusUpdate = async () => {
    if (!ride) return
    
    const statusInfo = getStatusInfo(ride.status)
    if (statusInfo.nextStatus) {
      await updateRideStatus(ride.id, statusInfo.nextStatus as any)
    }
  }

  const getRouteCoords = (): { origin: LocationCoords; destination: LocationCoords } | null => {
    if (!ride || !currentLocation) return null

    // If ride is in progress, show route to destination
    if (ride.status === 'in_progress') {
      return {
        origin: currentLocation,
        destination: { lat: ride.destination_lat, lng: ride.destination_lng }
      }
    }
    
    // Otherwise, show route to pickup location
    return {
      origin: currentLocation,
      destination: { lat: ride.origin_lat, lng: ride.origin_lng }
    }
  }

  const getMapMarkers = () => {
    if (!ride) return []
    
    const markers = []
    
    // Always show pickup location
    markers.push({
      position: { lat: ride.origin_lat, lng: ride.origin_lng },
      title: 'Local de embarque',
      icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
    })

    // Always show destination
    markers.push({
      position: { lat: ride.destination_lat, lng: ride.destination_lng },
      title: 'Destino',
      icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
    })

    // Show current location if available
    if (currentLocation) {
      markers.push({
        position: currentLocation,
        title: 'Sua localização',
        icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
      })
    }

    return markers
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2">Carregando corrida...</p>
        </div>
      </div>
    )
  }

  if (!ride) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p>Corrida não encontrada</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(ride.status)
  const routeCoords = getRouteCoords()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Corrida Ativa</h1>
            <Badge className={`${statusInfo.color} text-white`}>
              {statusInfo.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="h-64">
        <GoogleMap
          center={currentLocation || { lat: ride.origin_lat, lng: ride.origin_lng }}
          zoom={14}
          height="100%"
          markers={getMapMarkers()}
          showRoute={routeCoords ? {
            origin: routeCoords.origin,
            destination: routeCoords.destination,
            color: ride.status === 'in_progress' ? '#ef4444' : '#3b82f6'
          } : undefined}
        />
      </div>

      {/* Ride Details */}
      <div className="p-4 space-y-4">
        {/* Passenger Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Informações do Passageiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">{ride.passenger.full_name}</span>
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4 mr-1" />
                {ride.passenger.phone}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Route Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Rota
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-0.5 h-8 bg-gray-300"></div>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm font-medium text-green-700">
                    {ride.status === 'in_progress' ? 'Origem' : 'Embarque'}
                  </p>
                  <p className="text-sm text-muted-foreground">{ride.origin_address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">Destino</p>
                  <p className="text-sm text-muted-foreground">{ride.destination_address}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trip Details */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium">
                  R$ {ride.estimated_price?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-medium">
                  {ride.estimated_duration_minutes || 0} min
                </span>
              </div>
              {ride.distance_km && (
                <div className="font-medium">
                  {ride.distance_km.toFixed(1)} km
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        {statusInfo.action && statusInfo.nextStatus && (
          <Button
            onClick={handleStatusUpdate}
            disabled={loading}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {loading ? (
              'Atualizando...'
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                {statusInfo.action}
              </>
            )}
          </Button>
        )}

        {ride.status === 'completed' && (
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-medium">Corrida finalizada com sucesso!</p>
            <Button 
              onClick={() => navigate('/dashboard')} 
              className="mt-3"
              variant="outline"
            >
              Voltar ao Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
