
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { LocationCoords } from '@/hooks/useGeolocation'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

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
  const [apiKeyStatus, setApiKeyStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const markersRef = useRef<google.maps.Marker[]>([])
  const isInitializingRef = useRef(false)

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps || isInitializingRef.current) return
    
    isInitializingRef.current = true
    
    try {
      console.log('🗺️ Initializing Google Maps with center:', center)
      
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
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true,
      })

      const directionsServiceInstance = new google.maps.DirectionsService()
      const directionsRendererInstance = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: showRoute?.color || '#4285F4',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
      })

      directionsRendererInstance.setMap(mapInstance)
      
      setMap(mapInstance)
      setDirectionsService(directionsServiceInstance)
      setDirectionsRenderer(directionsRendererInstance)
      setIsLoading(false)
      setError(null)
      setApiKeyStatus('success')
      
      console.log('✅ Google Maps initialized successfully')
      
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

      // Add zoom change listener for better UX
      mapInstance.addListener('zoom_changed', () => {
        console.log('🔍 Map zoom changed to:', mapInstance.getZoom())
      })

    } catch (err) {
      console.error('❌ Error initializing map:', err)
      setError('Erro ao inicializar o mapa')
      setIsLoading(false)
      setApiKeyStatus('error')
    } finally {
      isInitializingRef.current = false
    }
  }, [center, zoom, onMapLoad, onLocationSelect, showRoute?.color])

  useEffect(() => {
    let isMounted = true
    let retryCount = 0
    const maxRetries = 3
    const retryDelay = 2000

    const loadGoogleMaps = async () => {
      if (!isMounted) return
      
      try {
        console.log('🚀 Starting Google Maps loading process...')
        setIsLoading(true)
        setError(null)
        setApiKeyStatus('loading')

        // Check if Google Maps is already loaded
        if (window.google?.maps) {
          console.log('✅ Google Maps already loaded, initializing...')
          initializeMap()
          return
        }

        // Check if user is authenticated
        if (!user) {
          console.log('❌ User not authenticated, waiting...')
          setError('Usuário não autenticado')
          setIsLoading(false)
          setApiKeyStatus('error')
          return
        }

        console.log('🔑 Fetching API key via edge function...')
        
        // Get API key from edge function with improved error handling
        let { data: keyData, error: keyError } = await supabase.functions.invoke('get-maps-key')
        
        if (!isMounted) return
        
        if (keyError) {
          console.error('❌ Error in edge function:', keyError)
          
          // Check if it's an authentication error
          if (keyError.message?.includes('401') || keyError.message?.includes('Unauthorized')) {
            console.log('🔄 Attempting to refresh session...')
            const { error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError) {
              throw new Error('Sessão expirada. Por favor, faça login novamente.')
            }
            
            if (!isMounted) return
            
            // Retry with refreshed session
            console.log('🔄 Retrying with refreshed session...')
            const retryResult = await supabase.functions.invoke('get-maps-key')
            
            if (retryResult.error) {
              throw new Error('Erro de autenticação. Por favor, faça login novamente.')
            }
            
            if (!retryResult.data?.apiKey) {
              throw new Error('Chave da API do Google Maps não encontrada após renovação da sessão')
            }
            
            keyData = retryResult.data
          } else {
            throw new Error(`Erro ao obter chave da API: ${keyError.message}`)
          }
        } else if (!keyData?.apiKey) {
          console.error('❌ API key not found in response:', keyData)
          throw new Error('Chave da API do Google Maps não encontrada')
        }

        console.log('🔑 API key obtained successfully, loading Google Maps...')
        
        // Validate API key format
        if (!keyData.apiKey.startsWith('AIza')) {
          console.warn('⚠️ API key format may be incorrect')
          toast.warning('Formato da chave API pode estar incorreto')
        }

        const loader = new Loader({
          apiKey: keyData.apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
          language: 'pt-BR',
          region: 'BR',
        })

        await loader.load()
        
        if (!isMounted) return
        
        console.log('✅ Google Maps loaded successfully!')
        toast.success('Google Maps carregado com sucesso!')
        initializeMap()
        
      } catch (error) {
        if (!isMounted) return
        
        console.error('💥 Error loading Google Maps:', error)
        setApiKeyStatus('error')
        
        if (retryCount < maxRetries) {
          retryCount++
          console.log(`🔄 Retry attempt ${retryCount}/${maxRetries} in ${retryDelay/1000} seconds...`)
          setTimeout(() => loadGoogleMaps(), retryDelay)
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
          setError(`Erro ao carregar o Google Maps: ${errorMessage}`)
          setIsLoading(false)
          
          // Show helpful toast message
          toast.error(`Erro no Google Maps: ${errorMessage}`, {
            duration: 8000,
            action: {
              label: 'Tentar novamente',
              onClick: () => {
                retryCount = 0
                loadGoogleMaps()
              }
            }
          })
        }
      }
    }

    loadGoogleMaps()

    return () => {
      isMounted = false
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
        animation: google.maps.Animation.DROP,
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

    console.log('🛣️ Calculating route:', showRoute)

    directionsService.route(
      {
        origin: showRoute.origin,
        destination: showRoute.destination,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        region: 'BR',
      },
      (result, status) => {
        if (status === 'OK' && result) {
          console.log('✅ Route calculated successfully')
          directionsRenderer.setDirections(result)
          
          // Fit map to show entire route
          const bounds = new google.maps.LatLngBounds()
          bounds.extend(showRoute.origin)
          bounds.extend(showRoute.destination)
          map.fitBounds(bounds)
        } else {
          console.error('❌ Error calculating route:', status)
          toast.error(`Erro ao calcular rota: ${status}`)
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
    return (
      <div
        style={{ height, width }}
        className={`rounded-lg border border-border flex items-center justify-center bg-muted ${className}`}
      >
        <div className="text-center p-4 max-w-md">
          <div className="mb-4">
            <div className="text-4xl mb-2">🗺️</div>
            <p className="text-destructive font-medium mb-2">Erro ao carregar o mapa</p>
          </div>
          <div className="text-sm text-muted-foreground mb-4 bg-background p-3 rounded text-left">
            {error}
          </div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div>
              <p className="font-medium mb-1">💡 Possíveis soluções:</p>
              <ul className="text-left space-y-1">
                <li>• Verifique se você está logado no sistema</li>
                <li>• Certifique-se de que a chave API está configurada</li>
                <li>• Verifique se as APIs necessárias estão habilitadas</li>
                <li>• Abra o DevTools (F12) para logs detalhados</li>
              </ul>
            </div>
            {apiKeyStatus === 'error' && (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded">
                <p className="text-destructive font-medium">⚠️ Problema com chave da API</p>
                <p className="text-xs">Verifique se a GOOGLE_MAPS_FRONTEND_API_KEY está configurada no Supabase</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            🔄 Recarregar Página
          </button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground font-medium">Carregando Google Maps...</p>
          <div className="mt-2 text-xs text-muted-foreground">
            {apiKeyStatus === 'loading' && '🔑 Obtendo chave da API...'}
            {apiKeyStatus === 'success' && '🗺️ Inicializando mapa...'}
          </div>
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
