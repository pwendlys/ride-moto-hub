import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Target, Clock, DollarSign } from 'lucide-react'
import { GoogleMap } from './GoogleMap'
import { LocationCoords, useGeolocation } from '@/hooks/useGeolocation'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface LocationSelection {
  coords: LocationCoords
  address: string
  type: 'current' | 'selected' | 'searched'
}

interface MapSelectorProps {
  onRouteCalculated?: (route: {
    origin: LocationSelection
    destination: LocationSelection
    distance: number
    duration: number
    price: number
  }) => void
  onLocationSelect?: (type: 'origin' | 'destination', location: LocationSelection) => void
}

export const MapSelector: React.FC<MapSelectorProps> = ({
  onRouteCalculated,
  onLocationSelect,
}) => {
  const { coords: currentLocation, loading: locationLoading } = useGeolocation()
  const [origin, setOrigin] = useState<LocationSelection | null>(null)
  const [destination, setDestination] = useState<LocationSelection | null>(null)
  const [originQuery, setOriginQuery] = useState('')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [originResults, setOriginResults] = useState<any[]>([])
  const [destinationResults, setDestinationResults] = useState<any[]>([])
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false)
  const [isSearchingDestination, setIsSearchingDestination] = useState(false)
  const [mapCenter, setMapCenter] = useState<LocationCoords>({ lat: -18.9146, lng: -48.2754 })
  const [routeInfo, setRouteInfo] = useState<any>(null)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [isGettingAddress, setIsGettingAddress] = useState(false)

  // Function to get address from coordinates using reverse geocoding
  const getAddressFromCoords = async (coords: LocationCoords): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'reverse-geocode',
          lat: coords.lat,
          lng: coords.lng,
        },
      })

      if (error) throw error

      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address
      }
      
      return 'Localização atual'
    } catch (error) {
      console.error('Erro no reverse geocoding:', error)
      return 'Localização atual'
    }
  }

  // Auto-set current location as origin with reverse geocoding
  useEffect(() => {
    if (currentLocation && !origin && !locationLoading) {
      const setCurrentLocationWithAddress = async () => {
        const address = await getAddressFromCoords(currentLocation)
        
        const currentLocationData: LocationSelection = {
          coords: currentLocation,
          address,
          type: 'current',
        }
        
        setOrigin(currentLocationData)
        setOriginQuery(address)
        setMapCenter(currentLocation)
        onLocationSelect?.('origin', currentLocationData)
      }

      setCurrentLocationWithAddress()
    }
  }, [currentLocation, origin, onLocationSelect, locationLoading])

  // Debounced search function
  const searchPlaces = useCallback(async (query: string, type: 'origin' | 'destination') => {
    if (!query.trim()) {
      if (type === 'origin') setOriginResults([])
      else setDestinationResults([])
      return
    }

    if (type === 'origin') setIsSearchingOrigin(true)
    else setIsSearchingDestination(true)

    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'places-autocomplete',
          input: query,
        },
      })

      if (error) throw error

      if (type === 'origin') {
        setOriginResults(data.predictions || [])
      } else {
        setDestinationResults(data.predictions || [])
      }
    } catch (error) {
      console.error('Erro na busca:', error)
      toast.error('Erro ao buscar endereços')
    } finally {
      if (type === 'origin') setIsSearchingOrigin(false)
      else setIsSearchingDestination(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (originQuery && originQuery !== 'Localização atual' && originQuery !== 'Obtendo endereço...') {
        searchPlaces(originQuery, 'origin')
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [originQuery, searchPlaces])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (destinationQuery) {
        searchPlaces(destinationQuery, 'destination')
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [destinationQuery, searchPlaces])

  const selectPlace = async (place: any, type: 'origin' | 'destination') => {
    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'place-details',
          place_id: place.place_id,
        },
      })

      if (error) throw error

      const location: LocationSelection = {
        coords: {
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
        },
        address: data.result.formatted_address,
        type: 'searched',
      }

      if (type === 'origin') {
        setOrigin(location)
        setOriginQuery(data.result.formatted_address)
        setOriginResults([])
        onLocationSelect?.('origin', location)
      } else {
        setDestination(location)
        setDestinationQuery(data.result.formatted_address)
        setDestinationResults([])
        onLocationSelect?.('destination', location)
      }

      setMapCenter(location.coords)
    } catch (error) {
      console.error('Erro ao obter detalhes do local:', error)
      toast.error('Erro ao selecionar local')
    }
  }

  const calculateRoute = async () => {
    if (!origin || !destination) return

    setIsCalculatingRoute(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'directions',
          origin: `${origin.coords.lat},${origin.coords.lng}`,
          destination: `${destination.coords.lat},${destination.coords.lng}`,
        },
      })

      if (error) throw error

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        const leg = route.legs[0]
        
        const distanceKm = leg.distance.value / 1000
        const basePrice = 8.00
        const pricePerKm = 2.50
        const estimatedPrice = Math.max(basePrice, basePrice + (distanceKm * pricePerKm))

        const routeData = {
          origin,
          destination,
          distance: distanceKm,
          duration: leg.duration.value / 60,
          price: estimatedPrice,
        }

        setRouteInfo(routeData)
        onRouteCalculated?.(routeData)
      }
    } catch (error) {
      console.error('Erro no cálculo de rota:', error)
      toast.error('Erro ao calcular rota')
    } finally {
      setIsCalculatingRoute(false)
    }
  }

  const useCurrentLocation = async () => {
    if (!currentLocation) return

    setIsGettingAddress(true)
    
    // Show loading state
    setOriginQuery('Obtendo endereço...')
    
    try {
      // Get real address using reverse geocoding
      const address = await getAddressFromCoords(currentLocation)

      const currentLocationData: LocationSelection = {
        coords: currentLocation,
        address,
        type: 'current',
      }
      
      setOrigin(currentLocationData)
      setOriginQuery(address)
      setOriginResults([])
      setMapCenter(currentLocation)
      onLocationSelect?.('origin', currentLocationData)
    } finally {
      setIsGettingAddress(false)
    }
  }

  // Calculate route when both locations are set
  useEffect(() => {
    if (origin && destination) {
      calculateRoute()
    }
  }, [origin, destination])

  const markers = []
  if (origin) {
    markers.push({
      position: origin.coords,
      title: 'Origem',
      icon: '/placeholder.svg', // Verde para origem
    })
  }
  if (destination) {
    markers.push({
      position: destination.coords,
      title: 'Destino',
      icon: '/placeholder.svg', // Vermelho para destino
    })
  }

  const isRouteValid = origin && destination

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Definir Trajeto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Origin Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              📍 Origem
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder={locationLoading ? "Obtendo localização..." : "Digite o endereço de origem"}
                  value={originQuery}
                  onChange={(e) => setOriginQuery(e.target.value)}
                  disabled={locationLoading}
                  className="pr-10"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={useCurrentLocation}
                disabled={!currentLocation || locationLoading || isGettingAddress}
                title="Usar localização atual"
              >
                {isGettingAddress ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Origin Autocomplete Results */}
            {originResults.length > 0 && (
              <div className="relative">
                <div className="absolute top-0 z-20 w-full rounded-md border bg-card shadow-lg max-h-60 overflow-y-auto">
                  {originResults.map((place, index) => (
                    <button
                      key={index}
                      className="w-full p-3 text-left hover:bg-accent border-b border-border last:border-b-0"
                      onClick={() => selectPlace(place, 'origin')}
                    >
                      <div className="font-medium text-sm">{place.structured_formatting.main_text}</div>
                      <div className="text-xs text-muted-foreground">
                        {place.structured_formatting.secondary_text}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Destination Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              🎯 Destino
            </label>
            <div className="relative">
              <Input
                placeholder="Digite o endereço de destino"
                value={destinationQuery}
                onChange={(e) => setDestinationQuery(e.target.value)}
              />
            </div>
            
            {/* Destination Autocomplete Results */}
            {destinationResults.length > 0 && (
              <div className="relative">
                <div className="absolute top-0 z-20 w-full rounded-md border bg-card shadow-lg max-h-60 overflow-y-auto">
                  {destinationResults.map((place, index) => (
                    <button
                      key={index}
                      className="w-full p-3 text-left hover:bg-accent border-b border-border last:border-b-0"
                      onClick={() => selectPlace(place, 'destination')}
                    >
                      <div className="font-medium text-sm">{place.structured_formatting.main_text}</div>
                      <div className="text-xs text-muted-foreground">
                        {place.structured_formatting.secondary_text}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Route Summary */}
          {isRouteValid && routeInfo && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Resumo da Viagem</h3>
                {isCalculatingRoute && (
                  <div className="text-xs text-muted-foreground">Calculando...</div>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">Distância</div>
                  <div className="font-semibold text-sm">{routeInfo.distance.toFixed(1)} km</div>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">Tempo</div>
                  <div className="font-semibold text-sm">{Math.round(routeInfo.duration)} min</div>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">Preço</div>
                  <div className="font-semibold text-sm">R$ {routeInfo.price.toFixed(2)}</div>
                </div>
              </div>

              {/* Address Confirmation */}
              <div className="mt-4 pt-3 border-t border-primary/20">
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>
                      <span className="font-medium">De:</span> {origin.address}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>
                      <span className="font-medium">Para:</span> {destination.address}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {!origin && !locationLoading && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                📍 Defina o local de origem para começar
              </p>
            </div>
          )}
          
          {origin && !destination && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                🎯 Agora defina o destino da viagem
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border">
        <GoogleMap
          center={mapCenter}
          height="400px"
          markers={markers}
          showRoute={
            isRouteValid
              ? {
                  origin: origin.coords,
                  destination: destination.coords,
                  color: '#3B82F6'
                }
              : undefined
          }
        />
      </div>
    </div>
  )
}