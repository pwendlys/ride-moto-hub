import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Search, X } from 'lucide-react'
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
  const { coords: currentLocation, loading: locationLoading, error: locationError } = useGeolocation()
  const [origin, setOrigin] = useState<LocationSelection | null>(null)
  const [destination, setDestination] = useState<LocationSelection | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectingFor, setSelectingFor] = useState<'origin' | 'destination' | null>(null)
  const [mapCenter, setMapCenter] = useState<LocationCoords>({ lat: -18.9146, lng: -48.2754 })
  const [routeInfo, setRouteInfo] = useState<any>(null)

  // Set current location as origin when available
  useEffect(() => {
    if (currentLocation && !origin) {
      const currentLocationData: LocationSelection = {
        coords: currentLocation,
        address: 'Localização atual',
        type: 'current',
      }
      setOrigin(currentLocationData)
      setMapCenter(currentLocation)
      onLocationSelect?.('origin', currentLocationData)
    }
  }, [currentLocation, origin, onLocationSelect])

  const searchPlaces = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'places-autocomplete',
          input: query,
        },
      })

      if (error) throw error

      setSearchResults(data.predictions || [])
    } catch (error) {
      console.error('Erro na busca:', error)
      toast.error('Erro ao buscar endereços')
    } finally {
      setSearchLoading(false)
    }
  }

  const selectPlace = async (place: any) => {
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

      if (selectingFor === 'origin') {
        setOrigin(location)
        onLocationSelect?.('origin', location)
      } else if (selectingFor === 'destination') {
        setDestination(location)
        onLocationSelect?.('destination', location)
      }

      setSearchQuery('')
      setSearchResults([])
      setSelectingFor(null)
      setMapCenter(location.coords)
    } catch (error) {
      console.error('Erro ao obter detalhes do local:', error)
      toast.error('Erro ao selecionar local')
    }
  }

  const calculateRoute = async () => {
    if (!origin || !destination) return

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
        
        // Calcular preço baseado na distância
        const distanceKm = leg.distance.value / 1000
        const basePrice = 8.00 // Tarifa mínima
        const pricePerKm = 2.50
        const estimatedPrice = Math.max(basePrice, basePrice + (distanceKm * pricePerKm))

        const routeData = {
          origin,
          destination,
          distance: distanceKm,
          duration: leg.duration.value / 60, // em minutos
          price: estimatedPrice,
        }

        setRouteInfo(routeData)
        onRouteCalculated?.(routeData)
      }
    } catch (error) {
      console.error('Erro no cálculo de rota:', error)
      toast.error('Erro ao calcular rota')
    }
  }

  const handleMapClick = (coords: LocationCoords) => {
    if (!selectingFor) return

    const location: LocationSelection = {
      coords,
      address: 'Local selecionado no mapa',
      type: 'selected',
    }

    if (selectingFor === 'origin') {
      setOrigin(location)
      onLocationSelect?.('origin', location)
    } else if (selectingFor === 'destination') {
      setDestination(location)
      onLocationSelect?.('destination', location)
    }

    setSelectingFor(null)
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Selecionar Localização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar endereço..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    searchPlaces(e.target.value)
                  }}
                  className="pl-10"
                />
              </div>
              {selectingFor && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectingFor(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full z-10 mt-1 w-full rounded-md border bg-card shadow-lg">
                {searchResults.map((place, index) => (
                  <button
                    key={index}
                    className="w-full p-3 text-left hover:bg-accent"
                    onClick={() => selectPlace(place)}
                  >
                    <div className="font-medium">{place.structured_formatting.main_text}</div>
                    <div className="text-sm text-muted-foreground">
                      {place.structured_formatting.secondary_text}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location Selection Buttons */}
          <div className="flex gap-2">
            <Button
              variant={selectingFor === 'origin' ? 'default' : 'outline'}
              onClick={() => setSelectingFor('origin')}
              className="flex-1"
            >
              {selectingFor === 'origin' ? 'Clique no mapa para origem' : 'Definir Origem'}
            </Button>
            <Button
              variant={selectingFor === 'destination' ? 'default' : 'outline'}
              onClick={() => setSelectingFor('destination')}
              className="flex-1"
            >
              {selectingFor === 'destination' ? 'Clique no mapa para destino' : 'Definir Destino'}
            </Button>
          </div>

          {/* Current Location Button */}
          {currentLocation && (
            <Button
              variant="outline"
              onClick={() => {
                const currentLocationData: LocationSelection = {
                  coords: currentLocation,
                  address: 'Localização atual',
                  type: 'current',
                }
                if (selectingFor === 'origin') {
                  setOrigin(currentLocationData)
                  onLocationSelect?.('origin', currentLocationData)
                } else if (selectingFor === 'destination') {
                  setDestination(currentLocationData)
                  onLocationSelect?.('destination', currentLocationData)
                }
                setSelectingFor(null)
              }}
              disabled={!selectingFor}
              className="w-full"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Usar Localização Atual
            </Button>
          )}

          {/* Selected Locations */}
          <div className="space-y-2">
            {origin && (
              <div className="flex items-center justify-between p-2 bg-accent rounded-lg">
                <div>
                  <Badge variant="secondary" className="mb-1">Origem</Badge>
                  <p className="text-sm">{origin.address}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrigin(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {destination && (
              <div className="flex items-center justify-between p-2 bg-accent rounded-lg">
                <div>
                  <Badge variant="secondary" className="mb-1">Destino</Badge>
                  <p className="text-sm">{destination.address}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDestination(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Route Information */}
          {routeInfo && (
            <div className="p-4 bg-primary/10 rounded-lg">
              <h3 className="font-semibold mb-2">Informações da Rota</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Distância:</span>
                  <p className="font-medium">{routeInfo.distance.toFixed(1)} km</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tempo:</span>
                  <p className="font-medium">{Math.round(routeInfo.duration)} min</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Preço:</span>
                  <p className="font-medium">R$ {routeInfo.price.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map */}
      <GoogleMap
        center={mapCenter}
        height="400px"
        markers={markers}
        onLocationSelect={handleMapClick}
        showRoute={
          origin && destination
            ? {
                origin: origin.coords,
                destination: destination.coords,
              }
            : undefined
        }
      />
    </div>
  )
}