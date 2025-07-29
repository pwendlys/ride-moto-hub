import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface RideNotification {
  id: string
  ride_id: string
  driver_id: string
  notified_at: string
  expires_at: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  distance_km?: number
  ride?: {
    origin_address: string
    destination_address: string
    estimated_price?: number
    passenger: {
      full_name: string
      phone: string
    }
  }
}

export const useRideQueue = () => {
  const [activeNotifications, setActiveNotifications] = useState<RideNotification[]>([])
  const [isListening, setIsListening] = useState(false)
  const { toast } = useToast()

  const startListening = useCallback(async () => {
    if (isListening) return

    try {
      setIsListening(true)
      console.log('🔔 Starting ride notification listener')

      // Get current user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('❌ Erro ao obter usuário para listener:', userError)
        setIsListening(false)
        toast({
          title: "Erro de autenticação",
          description: "Não foi possível identificar o motorista. Faça login novamente.",
          variant: "destructive"
        })
        return
      }

      console.log(`🔔 Configurando listener para motorista: ${user.id}`)

      // Buscar notificações pendentes existentes primeiro
      await fetchPendingNotifications(user.id, setActiveNotifications)

      // Verificar conectividade real-time
      console.log('🔗 Testando conectividade real-time...')
      
      // Subscribe to ALL ride notifications (broadcast system)
      const channel = supabase
        .channel('ride-broadcast-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ride_notifications',
            filter: `driver_id=eq.${user.id}`
          },
          async (payload) => {
            const notification = payload.new as RideNotification
            console.log('📨 New ride notification received:', notification)

          // Verificar se a notificação é para este motorista
          if (notification.driver_id !== user.id) {
            console.log('⚠️ Notificação recebida para outro motorista, ignorando')
            return
          }

          console.log('✅ Notificação confirmada para este motorista')

          // Fetch complete ride data
          const enrichedNotification = await enrichNotificationData(notification)
          if (enrichedNotification) {
            setActiveNotifications(prev => [enrichedNotification, ...prev])
            
            toast({
              title: "Nova corrida disponível!",
              description: `De: ${enrichedNotification.ride?.origin_address}`,
              duration: 10000
            })

            console.log('🔔 Notificação adicionada à lista:', enrichedNotification)

            // Play notification sound
            try {
              const audio = new Audio('/notification.mp3')
              audio.play().catch(() => console.log('🔔 Nova corrida!'))
            } catch {
              console.log('🔔 Nova corrida!')
            }
          } else {
            console.error('❌ Erro ao enriquecer dados da notificação')
          }
        }
      )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rides',
          },
          (payload) => {
            const updatedRide = payload.new as any
            console.log('📝 Ride updated:', updatedRide)
            
            // Remove all notifications for this ride if it was accepted or expired
            if (updatedRide.status !== 'requested') {
              console.log(`🗑️ Removendo notificações da corrida ${updatedRide.id} - status: ${updatedRide.status}`)
              setActiveNotifications(prev => 
                prev.filter(n => n.ride_id !== updatedRide.id)
              )
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'ride_notifications',
            filter: `driver_id=eq.${user.id}`
          },
          (payload) => {
            const updatedNotification = payload.new as RideNotification
            console.log('📝 Notification updated:', updatedNotification)
            
            // Remove notification if expired or accepted
            if (updatedNotification.status !== 'pending') {
              console.log(`🗑️ Removendo notificação com status: ${updatedNotification.status}`)
              setActiveNotifications(prev => 
                prev.filter(n => n.id !== updatedNotification.id)
              )
            }
          }
        )
      .subscribe((status) => {
        console.log('📡 Status da conexão real-time:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Listener configurado e ativo')
          toast({
            title: "Conectado!",
            description: "Aguardando corridas disponíveis...",
            duration: 3000
          })
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro na conexão real-time')
          toast({
            title: "Erro de conexão",
            description: "Tentando reconectar...",
            variant: "destructive",
            duration: 3000
          })
          // Tentar reconectar após 3 segundos
          setTimeout(() => {
            if (!isListening) startListening()
          }, 3000)
        }
      })

      // Cleanup function
      return () => {
        console.log('🔕 Removendo listener')
        supabase.removeChannel(channel)
        setIsListening(false)
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar listener:', error)
      setIsListening(false)
      toast({
        title: "Erro",
        description: "Erro ao conectar ao sistema de notificações",
        variant: "destructive"
      })
    }
  }, [isListening, toast])

  const stopListening = useCallback(() => {
    setIsListening(false)
    setActiveNotifications([])
    console.log('🔕 Stopped ride notification listener')
  }, [])

  const acceptNotification = useCallback(async (notificationId: string, rideId: string) => {
    try {
      console.log(`✅ Accepting ride notification: ${notificationId}`)

      // Accept the ride
      const { error: rideError } = await supabase
        .from('rides')
        .update({
          driver_id: (await supabase.auth.getUser()).data.user?.id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', rideId)
        .eq('status', 'requested') // Only if still available

      if (rideError) throw rideError

      // Mark notification as accepted
      const { error: notificationError } = await supabase
        .from('ride_notifications')
        .update({ status: 'accepted' })
        .eq('id', notificationId)

      if (notificationError) throw notificationError

      // Mark all other notifications for this ride as expired
      await supabase
        .from('ride_notifications')
        .update({ status: 'expired' })
        .eq('ride_id', rideId)
        .neq('id', notificationId)

      // Remove ALL notifications for this ride from local state (broadcast effect)
      setActiveNotifications(prev => prev.filter(n => n.ride_id !== rideId))

      toast({
        title: "Corrida aceita!",
        description: "Você aceitou a corrida. Dirija-se ao local de embarque."
      })

      return { success: true }
    } catch (error) {
      console.error('Error accepting notification:', error)
      toast({
        title: "Erro",
        description: "Esta corrida já foi aceita por outro motorista",
        variant: "destructive"
      })
      
      // Remove from local state anyway
      setActiveNotifications(prev => prev.filter(n => n.id !== notificationId))
      return { success: false, error }
    }
  }, [toast])

  const declineNotification = useCallback(async (notificationId: string) => {
    try {
      console.log(`❌ Declining ride notification: ${notificationId}`)

      // Mark notification as expired (declined)
      await supabase
        .from('ride_notifications')
        .update({ status: 'expired' })
        .eq('id', notificationId)

      // Remove from local state
      setActiveNotifications(prev => prev.filter(n => n.id !== notificationId))

      toast({
        title: "Corrida recusada",
        description: "A corrida foi removida da sua lista."
      })
    } catch (error) {
      console.error('Error declining notification:', error)
    }
  }, [toast])

  // Cleanup expired notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setActiveNotifications(prev => {
        const filtered = prev.filter(notification => {
          const expiresAt = new Date(notification.expires_at)
          const isExpired = expiresAt <= now
          if (isExpired) {
            console.log(`⏰ Removendo notificação expirada: ${notification.id}`)
          }
          return !isExpired
        })
        return filtered
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Função para refresh manual das notificações
  const refreshNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await fetchPendingNotifications(user.id, setActiveNotifications)
    }
  }, [])

  return {
    activeNotifications,
    isListening,
    startListening,
    stopListening,
    acceptNotification,
    declineNotification,
    refreshNotifications
  }
}

// Função para buscar notificações pendentes do motorista
const fetchPendingNotifications = async (driverId: string, setActiveNotifications: React.Dispatch<React.SetStateAction<RideNotification[]>>) => {
  try {
    console.log('🔍 Buscando notificações pendentes existentes...')
    
    const { data: notifications, error } = await supabase
      .from('ride_notifications')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Erro ao buscar notificações pendentes:', error)
      return
    }

    console.log(`📋 Encontradas ${notifications.length} notificações pendentes`)

    // Enriquecer cada notificação com dados completos
    const enrichedNotifications = await Promise.all(
      notifications.map(notification => enrichNotificationData(notification as RideNotification))
    )

    // Filtrar notificações válidas e atualizar estado
    const validNotifications = enrichedNotifications.filter(Boolean) as RideNotification[]
    setActiveNotifications(validNotifications)

    if (validNotifications.length > 0) {
      console.log(`✅ ${validNotifications.length} notificações carregadas`)
    }

  } catch (error) {
    console.error('❌ Erro ao buscar notificações pendentes:', error)
  }
}

async function enrichNotificationData(notification: RideNotification): Promise<RideNotification | null> {
  try {
    console.log(`🔍 Enriquecendo dados da notificação: ${notification.id}`)
    
    // Fetch ride with passenger data
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', notification.ride_id)
      .single()

    if (rideError || !ride) {
      console.error('❌ Erro ao buscar dados da corrida:', rideError)
      return null
    }

    console.log('✅ Dados da corrida encontrados:', { 
      id: ride.id, 
      origin: ride.origin_address, 
      destination: ride.destination_address 
    })

    // Fetch passenger data
    const { data: passenger, error: passengerError } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', ride.passenger_id)
      .single()

    if (passengerError || !passenger) {
      console.error('❌ Erro ao buscar dados do passageiro:', passengerError)
      return null
    }

    console.log('✅ Dados do passageiro encontrados:', passenger.full_name)

    const enrichedData = {
      ...notification,
      ride: {
        origin_address: ride.origin_address,
        destination_address: ride.destination_address,
        estimated_price: ride.estimated_price,
        passenger
      }
    }

    console.log('✅ Notificação enriquecida com sucesso')
    return enrichedData

  } catch (error) {
    console.error('❌ Erro ao enriquecer dados da notificação:', error)
    return null
  }
}