import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface DiagnosticResult {
  step: string
  status: 'success' | 'error' | 'warning' | 'pending'
  message: string
  details?: any
}

export const MapDiagnostic: React.FC = () => {
  const { user } = useAuth()
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result])
  }

  const runDiagnostic = async () => {
    setIsRunning(true)
    setResults([])

    // 1. Check user authentication
    addResult({
      step: '1. Autenticação',
      status: user ? 'success' : 'error',
      message: user ? `Usuário autenticado: ${user.email}` : 'Usuário não autenticado'
    })

    if (!user) {
      setIsRunning(false)
      return
    }

    // 2. Test get-maps-key function
    try {
      addResult({
        step: '2. Função get-maps-key',
        status: 'pending',
        message: 'Testando função...'
      })

      const { data, error } = await supabase.functions.invoke('get-maps-key')
      
      if (error) {
        addResult({
          step: '2. Função get-maps-key',
          status: 'error',
          message: `Erro: ${error.message}`,
          details: error
        })
      } else if (data?.apiKey) {
        addResult({
          step: '2. Função get-maps-key',
          status: 'success',
          message: `API key obtida (${data.apiKey.length} caracteres)`,
          details: { keyPrefix: data.apiKey.substring(0, 10) + '...' }
        })

        // 3. Test Google Maps API loading
        addResult({
          step: '3. Google Maps API',
          status: 'pending',
          message: 'Testando carregamento...'
        })

        try {
          // Try to load a simple Google Maps API call
          const response = await fetch(`https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places&callback=initMap`)
          
          if (response.ok) {
            addResult({
              step: '3. Google Maps API',
              status: 'success',
              message: 'API key válida - Google Maps acessível'
            })
          } else {
            addResult({
              step: '3. Google Maps API',
              status: 'error',
              message: `Erro HTTP: ${response.status}`,
              details: { status: response.status, statusText: response.statusText }
            })
          }
        } catch (apiError) {
          addResult({
            step: '3. Google Maps API',
            status: 'warning',
            message: 'Não foi possível testar diretamente - teste no mapa real'
          })
        }
      } else {
        addResult({
          step: '2. Função get-maps-key',
          status: 'error',
          message: 'API key não encontrada na resposta',
          details: data
        })
      }
    } catch (funcError) {
      addResult({
        step: '2. Função get-maps-key',
        status: 'error',
        message: `Erro crítico: ${funcError.message}`,
        details: funcError
      })
    }

    // 4. Check browser capabilities
    addResult({
      step: '4. Navegador',
      status: 'success',
      message: `${navigator.userAgent.split(' ').slice(-2).join(' ')}`,
      details: {
        geolocation: 'geolocation' in navigator,
        localStorage: typeof Storage !== 'undefined',
        fetch: typeof fetch !== 'undefined'
      }
    })

    setIsRunning(false)
  }

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
    }
  }

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      warning: 'secondary',
      pending: 'outline'
    } as const

    return (
      <Badge variant={variants[status]}>
        {status === 'pending' ? 'Testando...' : status}
      </Badge>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Diagnóstico do Google Maps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostic} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Executando diagnóstico...
            </>
          ) : (
            'Executar Diagnóstico'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.step}</span>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
                
                <p className="text-sm text-muted-foreground">{result.message}</p>
                
                {result.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver detalhes
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && !isRunning && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
            <h4 className="font-medium mb-2">💡 Próximos passos:</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Se algum teste falhou, verifique as configurações</li>
              <li>• Abra o DevTools (F12) para ver logs detalhados</li>
              <li>• Teste o mapa real após resolver os problemas</li>
              <li>• Se persistir, verifique as APIs habilitadas no Google Cloud</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}