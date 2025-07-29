import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export const useConnectionMonitor = () => {
  const [isConnected, setIsConnected] = useState(true)
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null)
  const { toast } = useToast()

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔗 [ConnectionMonitor] Testando conectividade...')
      
      // Simple connectivity test
      const { data, error } = await supabase
        .from('system_settings')
        .select('id')
        .limit(1)

      if (error) {
        console.error('❌ [ConnectionMonitor] Falha no teste:', error)
        return false
      }

      console.log('✅ [ConnectionMonitor] Conectividade OK')
      return true
    } catch (error) {
      console.error('❌ [ConnectionMonitor] Erro de conectividade:', error)
      return false
    }
  }, [])

  const performHeartbeat = useCallback(async () => {
    const connected = await testConnection()
    const now = new Date()
    
    setLastHeartbeat(now)
    
    if (connected !== isConnected) {
      setIsConnected(connected)
      
      if (!connected) {
        console.warn('⚠️ [ConnectionMonitor] Conexão perdida')
        toast({
          title: "Conexão perdida",
          description: "Tentando reconectar...",
          variant: "destructive",
          duration: 3000
        })
      } else {
        console.log('✅ [ConnectionMonitor] Conexão restaurada')
        toast({
          title: "Conexão restaurada",
          description: "Sistema online novamente",
          duration: 3000
        })
      }
    }
  }, [isConnected, testConnection, toast])

  // Heartbeat every 30 seconds
  useEffect(() => {
    const interval = setInterval(performHeartbeat, 30000)
    
    // Initial heartbeat
    performHeartbeat()
    
    return () => clearInterval(interval)
  }, [performHeartbeat])

  // Monitor online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 [ConnectionMonitor] Browser online')
      performHeartbeat()
    }

    const handleOffline = () => {
      console.warn('🌐 [ConnectionMonitor] Browser offline')
      setIsConnected(false)
      toast({
        title: "Sem conexão",
        description: "Verifique sua conexão com a internet",
        variant: "destructive"
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [performHeartbeat, toast])

  return {
    isConnected,
    lastHeartbeat,
    testConnection,
    performHeartbeat
  }
}