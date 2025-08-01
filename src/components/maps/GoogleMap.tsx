
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { LocationCoords } from '@/hooks/useGeolocation'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface GoogleMapProps {
  center?: LocationCoords
  zoom?: number
  height?: string
  width?: string
  onMapLoad?: (map: google.maps.Map) => void
  onLocationSelect?: (coords: LocationCoords, address?: string) => void
  markers?: Array<{
    position: LocationCoords
    title?: string
    icon?: string
    onClick?: () => void
  }>
  showRoute?: {
    origin: LocationCoords
    destination: LocationCoords
    color?: string
  }
  className?: string
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
  center = { lat: -18.9146, lng: -48.2754 }, // Centro de Uberlândia
  zoom = 15,
  height = '400px',
  width = '100%',
  onMapLoad,
  onLocationSelect,
  markers = [],
  showRoute,
  className = '',
}) => {
  const { user } = useAuth()
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const isInitializingRef = useRef(false)

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps || isInitializingRef.current) return
    
    isInitializingRef.current = true
    
    try {
      const mapInstance = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ],
      })

      const directionsServiceInstance = new google.maps.DirectionsService()
      const directionsRendererInstance = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: showRoute?.color || '#4285F4',
          strokeWeight: 4,
        },
      })

      directionsRendererInstance.setMap(mapInstance)
      
      setMap(mapInstance)
      setDirectionsService(directionsServiceInstance)
      setDirectionsRenderer(directionsRendererInstance)
      setIsLoading(false)
      setError(null)
      
      if (onMapLoad) {
        onMapLoad(mapInstance)
      }

      // Add click listener for location selection
      if (onLocationSelect) {
        mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const coords = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng(),
            }
            onLocationSelect(coords)
          }
        })
      }
    } catch (err) {
      console.error('Error initializing map:', err)
      setError('Erro ao inicializar o mapa')
      setIsLoading(false)
    } finally {
      isInitializingRef.current = false
    }
  }, [center, zoom, onMapLoad, onLocationSelect, showRoute?.color])

  useEffect(() => {
    let isMounted = true
    let retryCount = 0
    const maxRetries = 3
    let loadingTimeout: NodeJS.Timeout

    const loadGoogleMaps = async () => {
      if (!isMounted) return
      
      try {
        setIsLoading(true)
        setError(null)

        // Implementar timeout de 15 segundos
        loadingTimeout = setTimeout(() => {
          if (isMounted) {
            setError('Tempo limite excedido. Verifique sua conexão.')
            setIsLoading(false)
          }
        }, 15000)

        // Check if Google Maps is already loaded
        if (window.google?.maps) {
          clearTimeout(loadingTimeout)
          initializeMap()
          return
        }

        // Check if user is authenticated
        if (!user) {
          clearTimeout(loadingTimeout)
          setError('Usuário não autenticado')
          setIsLoading(false)
          return
        }
        
        // Get API key from edge function with improved error handling
        let { data: keyData, error: keyError } = await supabase.functions.invoke('get-maps-key')
        
        if (!isMounted) {
          clearTimeout(loadingTimeout)
          return
        }
        
        if (keyError) {
          // Check if it's an authentication error
          if (keyError.message?.includes('401') || keyError.message?.includes('Unauthorized') || keyError.message?.includes('TOKEN_EXPIRED')) {
            // Try to refresh the session
            const { error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError) {
              throw new Error('Sessão expirada. Por favor, faça login novamente.')
            }
            
            if (!isMounted) {
              clearTimeout(loadingTimeout)
              return
            }
            
            // Retry with refreshed session
            const retryResult = await supabase.functions.invoke('get-maps-key')
            
            if (retryResult.error) {
              throw new Error('Erro de autenticação. Por favor, faça login novamente.')
            }
            
            if (!retryResult.data?.apiKey) {
              throw new Error('Chave da API não encontrada')
            }
            
            // Use the retry data
            keyData = retryResult.data
          } else {
            throw new Error(`Erro ao obter chave da API: ${keyError.message}`)
          }
        } else if (!keyData?.apiKey) {
          throw new Error('Chave da API do Google Maps não encontrada')
        }

        // Validar API key
        if (keyData.apiKey.length < 30) {
          throw new Error('API key inválida - verifique a configuração')
        }

        const loader = new Loader({
          apiKey: keyData.apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
        })

        await loader.load()
        
        if (!isMounted) {
          clearTimeout(loadingTimeout)
          return
        }
        
        clearTimeout(loadingTimeout)
        initializeMap()
      } catch (error) {
        clearTimeout(loadingTimeout)
        
        if (!isMounted) return
        
        if (retryCount < maxRetries) {
          retryCount++
          const retryDelay = Math.min(2000 * Math.pow(2, retryCount - 1), 10000) // Backoff exponencial
          setTimeout(() => {
            if (isMounted) loadGoogleMaps()
          }, retryDelay)
        } else {
          setError(`Erro ao carregar o mapa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
          setIsLoading(false)
        }
      }
    }

    loadGoogleMaps()

    return () => {
      isMounted = false
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
    }
  }, [initializeMap, user])

  // Update markers
  useEffect(() => {
    if (!map) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Add new markers
    markers.forEach(markerData => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map,
        title: markerData.title,
        icon: markerData.icon,
      })

      if (markerData.onClick) {
        marker.addListener('click', markerData.onClick)
      }

      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null))
    }
  }, [map, markers])

  // Update route
  useEffect(() => {
    if (!map || !directionsService || !directionsRenderer || !showRoute) return

    directionsService.route(
      {
        origin: showRoute.origin,
        destination: showRoute.destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result)
        } else {
          console.error('Erro ao calcular rota:', status)
        }
      }
    )
  }, [map, directionsService, directionsRenderer, showRoute])

  // Update map center when props change
  useEffect(() => {
    if (map && center) {
      map.setCenter(center)
    }
  }, [map, center])

  if (error) {
    const handleRetry = () => {
      setError(null)
      setIsLoading(true)
      window.location.reload()
    }

    return (
      <div
        style={{ height, width }}
        className={`rounded-lg border border-border flex items-center justify-center bg-muted ${className}`}
      >
        <div className="text-center p-4">
          <p className="text-destructive font-medium mb-2">Erro ao carregar o mapa</p>
          <p className="text-sm text-muted-foreground mb-3">
            {error}
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <button 
              onClick={handleRetry}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        style={{ height, width }}
        className={`rounded-lg border border-border flex items-center justify-center bg-muted ${className}`}
      >
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      style={{ height, width }}
      className={`rounded-lg border border-border ${className}`}
    />
  )
}
