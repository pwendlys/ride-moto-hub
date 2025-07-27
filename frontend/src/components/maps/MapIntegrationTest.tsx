
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, XCircle, Clock, MapPin, Navigation, Route, Search } from 'lucide-react'
import { GoogleMap } from './GoogleMap'
import { useGeolocation } from '@/hooks/useGeolocation'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface TestResult {
  name: string
  status: 'idle' | 'running' | 'success' | 'error'
  message?: string
  duration?: number
}

export const MapIntegrationTest: React.FC = () => {
  const { coords: currentLocation, loading: locationLoading } = useGeolocation()
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Carregamento do Mapa', status: 'idle' },
    { name: 'Geolocalização', status: 'idle' },
    { name: 'Busca de Endereços', status: 'idle' },
    { name: 'Geocodificação Reversa', status: 'idle' },
    { name: 'Cálculo de Rotas', status: 'idle' },
    { name: 'Traçado de Rotas', status: 'idle' },
  ])

  const [isRunning, setIsRunning] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const updateTestStatus = (testName: string, status: TestResult['status'], message?: string, duration?: number) => {
    setTests(prev => prev.map(test => 
      test.name === testName ? { ...test, status, message, duration } : test
    ))
  }

  const runTest = async (testName: string, testFunction: () => Promise<void>) => {
    const startTime = Date.now()
    updateTestStatus(testName, 'running')
    
    try {
      await testFunction()
      const duration = Date.now() - startTime
      updateTestStatus(testName, 'success', 'Teste concluído com sucesso', duration)
    } catch (error) {
      const duration = Date.now() - startTime
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      updateTestStatus(testName, 'error', message, duration)
    }
  }

  const testMapLoading = async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout no carregamento do mapa'))
      }, 30000)

      const checkMap = () => {
        if (window.google?.maps) {
          clearTimeout(timeout)
          resolve()
        } else {
          setTimeout(checkMap, 100)
        }
      }
      checkMap()
    })
  }

  const testGeolocation = async () => {
    if (!currentLocation) {
      throw new Error('Geolocalização não disponível')
    }
    
    if (!currentLocation.lat || !currentLocation.lng) {
      throw new Error('Coordenadas inválidas')
    }
  }

  const testAddressSearch = async () => {
    const testQuery = 'Avenida Paulista, São Paulo'
    
    const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
      body: {
        action: 'places-autocomplete',
        input: testQuery,
      },
    })

    if (error) {
      throw new Error(`Erro na busca: ${error.message}`)
    }

    if (!data?.predictions || data.predictions.length === 0) {
      throw new Error('Nenhum resultado encontrado')
    }
  }

  const testReverseGeocode = async () => {
    if (!currentLocation) {
      throw new Error('Localização atual não disponível')
    }

    const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
      body: {
        action: 'reverse-geocode',
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      },
    })

    if (error) {
      throw new Error(`Erro na geocodificação: ${error.message}`)
    }

    if (!data?.results || data.results.length === 0) {
      throw new Error('Nenhum endereço encontrado')
    }
  }

  const testDirections = async () => {
    if (!currentLocation) {
      throw new Error('Localização atual não disponível')
    }

    const destination = { lat: -23.5505, lng: -46.6333 } // São Paulo

    const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
      body: {
        action: 'directions',
        origin: `${currentLocation.lat},${currentLocation.lng}`,
        destination: `${destination.lat},${destination.lng}`,
      },
    })

    if (error) {
      throw new Error(`Erro no cálculo de rotas: ${error.message}`)
    }

    if (!data?.routes || data.routes.length === 0) {
      throw new Error('Nenhuma rota encontrada')
    }
  }

  const testRouteDisplay = async () => {
    // Este teste verifica se o mapa consegue exibir rotas
    // Vai ser testado visualmente quando o mapa estiver carregado
    if (!showMap) {
      throw new Error('Mapa não está sendo exibido')
    }
  }

  const runAllTests = async () => {
    setIsRunning(true)
    setShowMap(true)
    
    try {
      await runTest('Carregamento do Mapa', testMapLoading)
      await runTest('Geolocalização', testGeolocation)
      await runTest('Busca de Endereços', testAddressSearch)
      await runTest('Geocodificação Reversa', testReverseGeocode)
      await runTest('Cálculo de Rotas', testDirections)
      await runTest('Traçado de Rotas', testRouteDisplay)
      
      toast.success('Todos os testes foram concluídos!')
    } catch (error) {
      toast.error('Erro durante os testes')
    } finally {
      setIsRunning(false)
    }
  }

  const resetTests = () => {
    setTests(prev => prev.map(test => ({ ...test, status: 'idle', message: undefined, duration: undefined })))
    setShowMap(false)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running': return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      idle: 'secondary',
      running: 'outline',
      success: 'default',
      error: 'destructive',
    } as const

    return (
      <Badge variant={variants[status]} className="ml-2">
        {status === 'idle' && 'Pendente'}
        {status === 'running' && 'Executando'}
        {status === 'success' && 'Sucesso'}
        {status === 'error' && 'Erro'}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Teste de Integração - Google Maps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runAllTests}
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? 'Executando Testes...' : 'Iniciar Testes'}
            </Button>
            <Button 
              onClick={resetTests}
              variant="outline"
              disabled={isRunning}
            >
              Reiniciar
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            {tests.map((test) => (
              <div key={test.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <p className="font-medium">{test.name}</p>
                    {test.message && (
                      <p className="text-sm text-muted-foreground">{test.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {test.duration && (
                    <span className="text-xs text-muted-foreground">
                      {test.duration}ms
                    </span>
                  )}
                  {getStatusBadge(test.status)}
                </div>
              </div>
            ))}
          </div>

          {locationLoading && (
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-blue-700 dark:text-blue-300">
                📍 Obtendo localização atual...
              </p>
            </div>
          )}

          {currentLocation && (
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-700 dark:text-green-300">
                ✅ Localização atual: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {showMap && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Visualização do Mapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoogleMap
              center={currentLocation || { lat: -23.5505, lng: -46.6333 }}
              height="400px"
              markers={currentLocation ? [{
                position: currentLocation,
                title: 'Sua Localização',
                icon: '/placeholder.svg'
              }] : []}
              onMapLoad={(map) => {
                console.log('✅ Mapa carregado no teste:', map)
                toast.success('Mapa carregado com sucesso!')
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
