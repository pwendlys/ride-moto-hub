import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Clock, DollarSign } from 'lucide-react'
import { LocationCoords, useGeolocation } from '@/hooks/useGeolocation'
import { supabase } from '@/integrations/supabase/client'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

interface LocationSelection {
  coords: LocationCoords
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

interface AddressSelectorProps {
  onRouteCalculated?: (route: RouteInfo) => void
}

export const AddressSelector: React.FC<AddressSelectorProps> = ({
  onRouteCalculated,
}) => {
  const { user } = useAuth()
  const { coords: currentLocation, loading: locationLoading } = useGeolocation()
  const { settings: systemSettings } = useSystemSettings()
  const [origin, setOrigin] = useState<LocationSelection | null>(null)
  const [destination, setDestination] = useState<LocationSelection | null>(null)
  const [originQuery, setOriginQuery] = useState('')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [originResults, setOriginResults] = useState<any[]>([])
  const [destinationResults, setDestinationResults] = useState<any[]>([])
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false)
  const [isSearchingDestination, setIsSearchingDestination] = useState(false)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [isGettingAddress, setIsGettingAddress] = useState(false)

  // Function to get address from coordinates using reverse geocoding
  const getAddressFromCoords = async (coords: LocationCoords): Promise<string> => {
    if (!user) return 'Localização atual'
    
    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'reverse-geocode',
          lat: coords.lat,
          lng: coords.lng,
        },
      })

      if (error || !data?.results?.length) {
        return 'Localização atual'
      }

      return data.results[0].formatted_address
    } catch (error) {
      return 'Localização atual'
    }
  }

  // Auto-set current location as origin
  useEffect(() => {
    if (currentLocation && !origin && !locationLoading && user) {
      const setCurrentLocationWithAddress = async () => {
        const address = await getAddressFromCoords(currentLocation)
        
        const currentLocationData: LocationSelection = {
          coords: currentLocation,
          address,
          type: 'current',
        }
        
        setOrigin(currentLocationData)
        setOriginQuery(address)
      }

      setCurrentLocationWithAddress()
    }
  }, [currentLocation, origin, locationLoading, user])

  // Debounced search function
  const searchPlaces = useCallback(async (query: string, type: 'origin' | 'destination') => {
    if (!query.trim() || !user) {
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

      if (error) {
        toast.error(`Erro na busca: ${error.message}`)
        return
      }

      if (data?.predictions) {
        if (type === 'origin') {
          setOriginResults(data.predictions)
        } else {
          setDestinationResults(data.predictions)
        }
      } else {
        if (type === 'origin') setOriginResults([])
        else setDestinationResults([])
      }
    } catch (error) {
      toast.error('Erro interno na busca de endereços')
    } finally {
      if (type === 'origin') setIsSearchingOrigin(false)
      else setIsSearchingDestination(false)
    }
  }, [user])

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (originQuery && originQuery !== 'Localização atual' && originQuery !== 'Carregando...') {
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
    if (!user) return
    
    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'place-details',
          place_id: place.place_id,
        },
      })

      if (error || !data?.result?.geometry?.location) {
        toast.error('Erro ao selecionar local')
        return
      }

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
      } else {
        setDestination(location)
        setDestinationQuery(data.result.formatted_address)
        setDestinationResults([])
      }
    } catch (error) {
      toast.error('Erro interno ao selecionar local')
    }
  }

  const calculateRoute = async () => {
    if (!origin || !destination || !user) return

    setIsCalculatingRoute(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
        body: {
          action: 'directions',
          origin: `${origin.coords.lat},${origin.coords.lng}`,
          destination: `${destination.coords.lat},${destination.coords.lng}`,
        },
      })

      if (error) {
        toast.error('Erro ao calcular rota')
        return
      }

      if (data?.routes && data.routes.length > 0) {
        const route = data.routes[0]
        const leg = route.legs[0]
        
        const distanceKm = leg.distance.value / 1000
        
        // Use dynamic pricing from system settings or defaults
        const settings = systemSettings || {
          fixed_rate: 5.0,
          price_per_km: 2.5,
          minimum_fare: 8.0,
          app_fee_percentage: 20.0,
          pricing_model: 'per_km',
          fee_type: 'percentage',
        }

        let totalPrice = 0
        let basePrice = 0
        let distancePrice = 0

        if (settings.pricing_model === 'fixed') {
          totalPrice = settings.fixed_rate
          basePrice = settings.fixed_rate
          distancePrice = 0
        } else {
          basePrice = settings.fixed_rate
          distancePrice = distanceKm * settings.price_per_km
          totalPrice = basePrice + distancePrice
        }

        const finalPrice = Math.max(totalPrice, settings.minimum_fare)

        let appFee = 0
        let driverEarnings = 0

        if (settings.fee_type === 'percentage') {
          appFee = finalPrice * (settings.app_fee_percentage / 100)
          driverEarnings = finalPrice - appFee
        } else {
          appFee = settings.app_fee_percentage
          driverEarnings = finalPrice - appFee
        }

        const routeData = {
          origin,
          destination,
          distance: distanceKm,
          duration: leg.duration.value / 60,
          price: finalPrice,
          driverEarnings,
          appFee,
          priceBreakdown: {
            basePrice,
            distancePrice,
            minimumFare: settings.minimum_fare,
            pricingModel: settings.pricing_model
          }
        }

        onRouteCalculated?.(routeData)
      }
    } catch (error) {
      toast.error('Erro ao calcular rota')
    } finally {
      setIsCalculatingRoute(false)
    }
  }

  const useCurrentLocation = async () => {
    if (!currentLocation || !user) return

    setIsGettingAddress(true)
    setOriginQuery('Carregando...')
    
    try {
      const address = await getAddressFromCoords(currentLocation)

      const currentLocationData: LocationSelection = {
        coords: currentLocation,
        address,
        type: 'current',
      }
      
      setOrigin(currentLocationData)
      setOriginQuery(address)
      setOriginResults([])
    } finally {
      setIsGettingAddress(false)
    }
  }

  // Calculate route when both locations are set
  useEffect(() => {
    if (origin && destination && user) {
      calculateRoute()
    }
  }, [origin, destination, user])

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Definir Trajeto
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Você precisa estar logado para usar o sistema
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
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
              />
              {/* Search Results for Origin */}
              {originResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {originResults.map((result, index) => (
                    <button
                      key={index}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-b-0"
                      onClick={() => selectPlace(result, 'origin')}
                    >
                      <div className="font-medium">{result.structured_formatting?.main_text}</div>
                      <div className="text-muted-foreground text-xs">
                        {result.structured_formatting?.secondary_text}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={useCurrentLocation}
              disabled={!currentLocation || locationLoading || isGettingAddress}
              title="Usar localização atual"
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </div>
          {isSearchingOrigin && (
            <p className="text-xs text-muted-foreground">Buscando endereços...</p>
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
            {/* Search Results for Destination */}
            {destinationResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {destinationResults.map((result, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-b-0"
                    onClick={() => selectPlace(result, 'destination')}
                  >
                    <div className="font-medium">{result.structured_formatting?.main_text}</div>
                    <div className="text-muted-foreground text-xs">
                      {result.structured_formatting?.secondary_text}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isSearchingDestination && (
            <p className="text-xs text-muted-foreground">Buscando endereços...</p>
          )}
        </div>

        {/* Route Status */}
        {origin && destination && (
          <div className="mt-4 p-3 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              {isCalculatingRoute ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Calculando rota e preço...</span>
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">Rota calculada! Veja os detalhes abaixo.</span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}