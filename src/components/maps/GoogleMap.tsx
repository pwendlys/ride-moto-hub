
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
        console.log('🗺️ [GoogleMap] Iniciando carregamento do Google Maps...')
        console.log('🔍 [GoogleMap] Estado atual:', {
          hasUser: !!user,
          userId: user?.id,
          hasGoogleMaps: !!window.google?.maps,
          timestamp: new Date().toISOString()
        })
        
        setIsLoading(true)
        setError(null)

        // Implementar timeout de 15 segundos
        loadingTimeout = setTimeout(() => {
          if (isMounted) {
            console.error('⏰ [GoogleMap] Timeout no carregamento do mapa')
            setError('Timeout no carregamento do mapa. Verifique sua conexão.')
            setIsLoading(false)
          }
        }, 15000)

        // Check if Google Maps is already loaded
        if (window.google?.maps) {
          console.log('✅ [GoogleMap] Google Maps já carregado, inicializando...')
          clearTimeout(loadingTimeout)
          initializeMap()
          return
        }

        // Check if user is authenticated
        if (!user) {
          console.log('❌ [GoogleMap] Usuário não autenticado, aguardando...')
          clearTimeout(loadingTimeout)
          setError('Usuário não autenticado')
          setIsLoading(false)
          return
        }

        console.log('📡 [GoogleMap] Buscando API key via edge function...')
        
        // Get API key from edge function with improved error handling
        let { data: keyData, error: keyError } = await supabase.functions.invoke('get-maps-key')
        
        if (!isMounted) {
          clearTimeout(loadingTimeout)
          return
        }
        
        console.log('📋 [GoogleMap] Resposta da edge function:', {
          hasData: !!keyData,
          hasError: !!keyError,
          hasApiKey: !!keyData?.apiKey,
          keyLength: keyData?.apiKey?.length || 0,
          errorMessage: keyError?.message
        })
        
        if (keyError) {
          console.error('❌ [GoogleMap] Erro na edge function:', keyError)
          
          // Check if it's an authentication error
          if (keyError.message?.includes('401') || keyError.message?.includes('Unauthorized') || keyError.message?.includes('TOKEN_EXPIRED')) {
            // Try to refresh the session
            console.log('🔄 [GoogleMap] Tentando renovar sessão...')
            const { error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError) {
              console.error('❌ [GoogleMap] Erro ao renovar sessão:', refreshError)
              throw new Error('Sessão expirada. Por favor, faça login novamente.')
            }
            
            if (!isMounted) {
              clearTimeout(loadingTimeout)
              return
            }
            
            // Retry with refreshed session
            console.log('🔄 [GoogleMap] Tentando novamente com sessão renovada...')
            const retryResult = await supabase.functions.invoke('get-maps-key')
            
            if (retryResult.error) {
              console.error('❌ [GoogleMap] Erro na segunda tentativa:', retryResult.error)
              throw new Error('Erro de autenticação. Por favor, faça login novamente.')
            }
            
            if (!retryResult.data?.apiKey) {
              console.error('❌ [GoogleMap] API key não encontrada após renovação')
              throw new Error('Chave da API do Google Maps não encontrada após renovação da sessão')
            }
            
            // Use the retry data
            keyData = retryResult.data
            console.log('✅ [GoogleMap] API key obtida após renovação da sessão')
          } else {
            throw new Error(`Erro ao obter chave da API: ${keyError.message}`)
          }
        } else if (!keyData?.apiKey) {
          console.error('❌ [GoogleMap] API key não encontrada na resposta:', keyData)
          throw new Error('Chave da API do Google Maps não encontrada')
        }

        // Validar API key
        if (keyData.apiKey.length < 30) {
          console.error('❌ [GoogleMap] API key suspeita (muito curta):', keyData.apiKey.length)
          throw new Error('API key inválida - verifique a configuração no Supabase')
        }

        console.log('🔑 [GoogleMap] API key obtida com sucesso, carregando Google Maps...', {
          keyLength: keyData.apiKey.length,
          keyPrefix: keyData.apiKey.substring(0, 10) + '...'
        })

        const loader = new Loader({
          apiKey: keyData.apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
        })

        console.log('⏳ [GoogleMap] Iniciando carregamento da biblioteca...')
        await loader.load()
        
        if (!isMounted) {
          clearTimeout(loadingTimeout)
          return
        }
        
        console.log('✅ [GoogleMap] Google Maps carregado com sucesso!')
        clearTimeout(loadingTimeout)
        initializeMap()
      } catch (error) {
        clearTimeout(loadingTimeout)
        
        if (!isMounted) return
        
        console.error('💥 [GoogleMap] Erro ao carregar Google Maps:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          retryCount,
          timestamp: new Date().toISOString()
        })
        
        if (retryCount < maxRetries) {
          retryCount++
          const retryDelay = Math.min(2000 * Math.pow(2, retryCount - 1), 10000) // Backoff exponencial
          console.log(`🔄 [GoogleMap] Tentativa ${retryCount}/${maxRetries} em ${retryDelay}ms...`)
          setTimeout(() => {
            if (isMounted) loadGoogleMaps()
          }, retryDelay)
        } else {
          setError(`Erro ao carregar o Google Maps: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
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
      console.log('🔄 [GoogleMap] Tentativa manual de retry...')
      setError(null)
      setIsLoading(true)
      // Force re-run of useEffect by creating a new user reference
      window.location.reload()
    }

    const openDiagnostic = () => {
      // Create diagnostic component in a new window/modal
      console.log('🔧 [GoogleMap] Abrindo diagnóstico...')
      const diagnosticWindow = window.open('', '_blank', 'width=800,height=600')
      if (diagnosticWindow) {
        diagnosticWindow.document.write(`
          <html>
            <head><title>Diagnóstico Google Maps</title></head>
            <body>
              <h1>Diagnóstico do Google Maps</h1>
              <p>Execute o diagnóstico na página principal.</p>
              <button onclick="window.close()">Fechar</button>
            </body>
          </html>
        `)
      }
    }

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
          <div className="mt-4 flex gap-2 flex-wrap justify-center">
            <button 
              onClick={handleRetry}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              🔄 Tentar Novamente
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
            >
              🔃 Recarregar Página
            </button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Problema persistente? Abra o F12 e procure por logs com [GoogleMap]
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
          <p className="text-muted-foreground mb-2">Carregando mapa...</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>🔍 Verificando autenticação...</p>
            <p>🔑 Obtendo chave da API...</p>
            <p>🗺️ Carregando Google Maps...</p>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Se demorar muito, abra o F12 para ver logs detalhados
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
