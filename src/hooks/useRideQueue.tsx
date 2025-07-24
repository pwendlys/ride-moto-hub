import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface RideNotification {
  id: string
  ride_id: string
  driver_id: string
  position_in_queue: number
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

  const startListening = useCallback(() => {
    if (isListening) return

    setIsListening(true)
    console.log('🔔 Starting ride notification listener')

    // Subscribe to ride notifications for current driver
    const channel = supabase
      .channel('ride-queue-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_notifications',
          filter: `driver_id=eq.${supabase.auth.getUser().then(u => u.data.user?.id)}`
        },
        async (payload) => {
          const notification = payload.new as RideNotification
          console.log('📨 New ride notification received:', notification)

          // Fetch complete ride data
          const enrichedNotification = await enrichNotificationData(notification)
          if (enrichedNotification) {
            setActiveNotifications(prev => [enrichedNotification, ...prev])
            
            toast({
              title: "Nova corrida disponível!",
              description: `De: ${enrichedNotification.ride?.origin_address}`,
              duration: 10000
            })

            // Play notification sound
            try {
              const audio = new Audio('/notification.mp3')
              audio.play().catch(() => console.log('🔔 Nova corrida!'))
            } catch {
              console.log('🔔 Nova corrida!')
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_notifications'
        },
        (payload) => {
          const updatedNotification = payload.new as RideNotification
          
          // Remove notification if expired or accepted by someone else
          if (updatedNotification.status !== 'pending') {
            setActiveNotifications(prev => 
              prev.filter(n => n.id !== updatedNotification.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      setIsListening(false)
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

      // Remove from local state
      setActiveNotifications(prev => prev.filter(n => n.id !== notificationId))

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
      setActiveNotifications(prev => 
        prev.filter(notification => {
          const expiresAt = new Date(notification.expires_at)
          return expiresAt > now
        })
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return {
    activeNotifications,
    isListening,
    startListening,
    stopListening,
    acceptNotification,
    declineNotification
  }
}

async function enrichNotificationData(notification: RideNotification): Promise<RideNotification | null> {
  try {
    // Fetch ride with passenger data
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', notification.ride_id)
      .single()

    if (rideError || !ride) {
      console.error('Error fetching ride data:', rideError)
      return null
    }

    // Fetch passenger data
    const { data: passenger, error: passengerError } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', ride.passenger_id)
      .single()

    if (passengerError || !passenger) {
      console.error('Error fetching passenger data:', passengerError)
      return null
    }

    return {
      ...notification,
      ride: {
        origin_address: ride.origin_address,
        destination_address: ride.destination_address,
        estimated_price: ride.estimated_price,
        passenger
      }
    }
  } catch (error) {
    console.error('Error enriching notification data:', error)
    return null
  }
}