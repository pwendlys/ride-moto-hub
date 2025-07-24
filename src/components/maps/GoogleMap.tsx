
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

    const loadGoogleMaps = async () => {
      if (!isMounted) return
      
      try {
        console.log('🗺️ Iniciando carregamento do Google Maps...')
        setIsLoading(true)
        setError(null)

        // Check if Google Maps is already loaded
        if (window.google?.maps) {
          console.log('✅ Google Maps já carregado, inicializando...')
          initializeMap()
          return
        }

        // Check if user is authenticated
        if (!user) {
          console.log('❌ Usuário não autenticado, aguardando...')
          setError('Usuário não autenticado')
          setIsLoading(false)
          return
        }

        console.log('📡 Buscando API key via edge function...')
        
        // Get API key from edge function with improved error handling
        let { data: keyData, error: keyError } = await supabase.functions.invoke('get-maps-key')
        
        if (!isMounted) return
        
        if (keyError) {
          console.error('❌ Erro na edge function:', keyError)
          
          // Check if it's an authentication error
          if (keyError.message?.includes('401') || keyError.message?.includes('Unauthorized')) {
            // Try to refresh the session
            console.log('🔄 Tentando renovar sessão...')
            const { error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError) {
              throw new Error('Sessão expirada. Por favor, faça login novamente.')
            }
            
            if (!isMounted) return
            
            // Retry with refreshed session
            console.log('🔄 Tentando novamente com sessão renovada...')
            const retryResult = await supabase.functions.invoke('get-maps-key')
            
            if (retryResult.error) {
              throw new Error('Erro de autenticação. Por favor, faça login novamente.')
            }
            
            if (!retryResult.data?.apiKey) {
              throw new Error('Chave da API do Google Maps não encontrada após renovação da sessão')
            }
            
            // Use the retry data
            keyData = retryResult.data
          } else {
            throw new Error(`Erro ao obter chave da API: ${keyError.message}`)
          }
        } else if (!keyData?.apiKey) {
          console.error('❌ API key não encontrada na resposta:', keyData)
          throw new Error('Chave da API do Google Maps não encontrada')
        }

        console.log('🔑 API key obtida com sucesso, carregando Google Maps...')

        const loader = new Loader({
          apiKey: keyData.apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
        })

        await loader.load()
        
        if (!isMounted) return
        
        console.log('✅ Google Maps carregado com sucesso!')
        initializeMap()
      } catch (error) {
        if (!isMounted) return
        
        console.error('💥 Erro ao carregar Google Maps:', error)
        
        if (retryCount < maxRetries) {
          retryCount++
          console.log(`🔄 Tentativa ${retryCount}/${maxRetries} em 2 segundos...`)
          setTimeout(() => loadGoogleMaps(), 2000)
        } else {
          setError(`Erro ao carregar o Google Maps: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
          setIsLoading(false)
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
    return (
      <div
        style={{ height, width }}
        className={`rounded-lg border border-border flex items-center justify-center bg-muted ${className}`}
      >
        <div className="text-center p-4 max-w-md">
          <p className="text-destructive font-medium mb-2">❌ Erro ao carregar o mapa</p>
          <p className="text-sm text-muted-foreground mb-3 bg-background p-2 rounded text-left">
            {error}
          </p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              💡 <strong>Possíveis soluções:</strong>
            </p>
            <ul className="text-left space-y-1">
              <li>• Verifique se você está logado no sistema</li>
              <li>• Certifique-se de que a API key está configurada</li>
              <li>• Abra o DevTools (F12) para ver logs detalhados</li>
              <li>• Verifique se as APIs estão habilitadas no Google Cloud</li>
            </ul>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
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
