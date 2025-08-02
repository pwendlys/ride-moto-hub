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
      console.log('🔍 Carregando dados da corrida:', id)
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', id)
        .single()

      if (rideError) throw rideError

      console.log('✅ Dados da corrida carregados:', rideData)
      

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
      console.error('❌ Erro ao carregar dados da corrida:', error)
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

  // Validate coordinates before creating markers and center
  const hasValidCoordinates = ride.origin_lat && ride.origin_lng && ride.destination_lat && ride.destination_lng

  const markers = hasValidCoordinates ? [
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
  ] : []

  const mapCenter = hasValidCoordinates ? {
    lat: (ride.origin_lat + ride.destination_lat) / 2,
    lng: (ride.origin_lng + ride.destination_lng) / 2,
  } : { lat: -21.764, lng: -43.350 } // Default center (Juiz de Fora)


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

        {/* Layout Compacto - Mapa Principal (70%) */}
        <div className="grid gap-4 lg:grid-cols-4 lg:h-[600px]">
          {/* Mapa - Ocupa mais espaço */}
          <div className="lg:col-span-3 h-[400px] lg:h-full">
            <Card className="h-full">
              <CardContent className="p-0 h-full">
                {!hasValidCoordinates ? (
                  <div className="h-full flex items-center justify-center bg-muted rounded-lg">
                    <div className="text-center p-6">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Coordenadas indisponíveis</p>
                    </div>
                  </div>
                ) : (
                  <GoogleMap
                    center={mapCenter}
                    height="100%"
                    width="100%"
                    markers={markers}
                    showRoute={{
                      origin: { lat: ride.origin_lat, lng: ride.origin_lng },
                      destination: { lat: ride.destination_lat, lng: ride.destination_lng },
                    }}
                    className="rounded-lg"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Informações Laterais - Compacto (30%) */}
          <div className="lg:col-span-1 space-y-4 lg:overflow-y-auto">
            {/* Status & Cancelar */}
            <Card>
              <CardContent className="p-4">
                <div className="text-center mb-3">
                  {getStatusBadge(ride.status)}
                </div>
                <p className="text-sm text-muted-foreground text-center mb-3">
                  {getStatusMessage(ride.status)}
                </p>
                {ride.status === 'requested' && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleCancelRide}
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Endereços Resumidos */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">De</p>
                    <p className="text-sm font-medium truncate">{ride.origin_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Para</p>
                    <p className="text-sm font-medium truncate">{ride.destination_address}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info da Corrida */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Distância</p>
                    <p className="text-sm font-semibold">{ride.distance_km?.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tempo</p>
                    <p className="text-sm font-semibold">{ride.estimated_duration_minutes} min</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Motorista - Se disponível */}
            {driverProfile && driverData && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-center mb-2">
                    <h4 className="text-sm font-semibold">{driverProfile.full_name}</h4>
                    <p className="text-xs text-muted-foreground">{driverProfile.phone}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className="text-xs">⭐</span>
                      <span className="text-xs">{driverData.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="text-center p-2 bg-accent rounded text-xs">
                    <p className="font-medium">{driverData.vehicle_brand} {driverData.vehicle_model}</p>
                    <p className="text-muted-foreground">{driverData.vehicle_color} • {driverData.vehicle_plate}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pagamento */}
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
                  <Badge variant="outline" className="mb-2">
                    {ride.payment_method === 'cash' ? 'Dinheiro' : 'Cartão'}
                  </Badge>
                  <p className="text-lg font-bold text-primary">
                    R$ {(ride.final_price || ride.estimated_price)?.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}