import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, MapPin, Clock, User, Car } from 'lucide-react'
import { GoogleMap } from '@/components/maps/GoogleMap'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

interface RideData {
  id: string
  status: string
  origin_address: string
  destination_address: string
  origin_lat: number
  origin_lng: number
  destination_lat: number
  destination_lng: number
  distance_km: number
  estimated_duration_minutes: number
  estimated_price: number
  final_price: number | null
  driver_id: string | null
  requested_at: string
  accepted_at: string | null
  started_at: string | null
  completed_at: string | null
  payment_method: string
}

interface DriverProfile {
  full_name: string
  phone: string
}

interface DriverData {
  vehicle_brand: string
  vehicle_model: string
  vehicle_plate: string
  vehicle_color: string
  rating: number
}

export default function RideTracking() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ride, setRide] = useState<RideData | null>(null)
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [driverData, setDriverData] = useState<DriverData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadRideData = async () => {
    if (!id) return

    try {
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', id)
        .single()

      if (rideError) throw rideError

      setRide(rideData)

      // If ride has a driver, load driver information
      if (rideData.driver_id) {
        const [profileResult, driverResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('user_id', rideData.driver_id)
            .single(),
          supabase
            .from('drivers')
            .select('vehicle_brand, vehicle_model, vehicle_plate, vehicle_color, rating')
            .eq('user_id', rideData.driver_id)
            .single(),
        ])

        if (profileResult.data) setDriverProfile(profileResult.data)
        if (driverResult.data) setDriverData(driverResult.data)
      }
    } catch (error) {
      console.error('Erro ao carregar dados da corrida:', error)
      toast.error('Erro ao carregar corrida')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRideData()
  }, [id])

  // Subscribe to real-time ride updates
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel('ride-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setRide(payload.new as RideData)
          if (payload.new.driver_id && !driverProfile) {
            loadRideData() // Reload to get driver data
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, driverProfile])

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      requested: { label: 'Solicitada', variant: 'secondary' as const },
      accepted: { label: 'Aceita', variant: 'default' as const },
      started: { label: 'Em Andamento', variant: 'default' as const },
      completed: { label: 'Concluída', variant: 'secondary' as const },
      cancelled: { label: 'Cancelada', variant: 'destructive' as const },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.requested
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'requested':
        return 'Aguardando um motorista aceitar sua corrida...'
      case 'accepted':
        return 'Motorista a caminho para te buscar!'
      case 'started':
        return 'Em viagem para o destino'
      case 'completed':
        return 'Corrida concluída com sucesso!'
      case 'cancelled':
        return 'Corrida foi cancelada'
      default:
        return 'Status desconhecido'
    }
  }

  const handleCancelRide = async () => {
    if (!ride || ride.status !== 'requested') return
    
    try {
      const { error } = await supabase
        .from('rides')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString() 
        })
        .eq('id', ride.id)

      if (error) throw error
      
      toast.success('Corrida cancelada com sucesso')
      navigate('/dashboard')
    } catch (error) {
      console.error('Erro ao cancelar corrida:', error)
      toast.error('Erro ao cancelar corrida')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando dados da corrida...</p>
        </div>
      </div>
    )
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Corrida não encontrada</h1>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const markers = [
    {
      position: { lat: ride.origin_lat, lng: ride.origin_lng },
      title: 'Origem',
      icon: '/placeholder.svg', // Green marker
    },
    {
      position: { lat: ride.destination_lat, lng: ride.destination_lng },
      title: 'Destino',
      icon: '/placeholder.svg', // Red marker
    },
  ]

  const mapCenter = {
    lat: (ride.origin_lat + ride.destination_lat) / 2,
    lng: (ride.origin_lng + ride.destination_lng) / 2,
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Acompanhar Corrida</h1>
            <p className="text-muted-foreground">#{ride.id.slice(0, 8)}</p>
          </div>
          {getStatusBadge(ride.status)}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Map */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-0">
                <GoogleMap
                  center={mapCenter}
                  height="400px"
                  markers={markers}
                  showRoute={{
                    origin: { lat: ride.origin_lat, lng: ride.origin_lng },
                    destination: { lat: ride.destination_lat, lng: ride.destination_lng },
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Ride Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status da Corrida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-accent rounded-lg">
                <p className="font-medium">{getStatusMessage(ride.status)}</p>
                {ride.status === 'requested' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCancelRide}
                    className="mt-3"
                  >
                    Cancelar Corrida
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                  <div>
                    <Badge variant="secondary" className="mb-1">Origem</Badge>
                    <p className="text-sm">{ride.origin_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5"></div>
                  <div>
                    <Badge variant="secondary" className="mb-1">Destino</Badge>
                    <p className="text-sm">{ride.destination_address}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center">
                  <MapPin className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Distância</p>
                  <p className="font-medium">{ride.distance_km?.toFixed(1)} km</p>
                </div>
                <div className="text-center">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Tempo Est.</p>
                  <p className="font-medium">{ride.estimated_duration_minutes} min</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          {driverProfile && driverData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Motorista
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">{driverProfile.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{driverProfile.phone}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm">⭐</span>
                    <span className="text-sm font-medium">{driverData.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{driverData.vehicle_brand} {driverData.vehicle_model}</p>
                    <p className="text-sm text-muted-foreground">
                      {driverData.vehicle_color} • {driverData.vehicle_plate}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price Information */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span>Método de Pagamento:</span>
                  <Badge variant="outline">
                    {ride.payment_method === 'cash' ? 'Dinheiro' : 'Cartão'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span>Valor:</span>
                  <span className="font-semibold">
                    R$ {(ride.final_price || ride.estimated_price)?.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}