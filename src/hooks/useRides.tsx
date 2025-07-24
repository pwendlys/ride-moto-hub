import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { LocationCoords } from './useGeolocation'

export interface Ride {
  id: string
  passenger_id: string
  driver_id?: string
  origin_address: string
  origin_lat: number
  origin_lng: number
  destination_address: string
  destination_lat: number
  destination_lng: number
  status: 'requested' | 'accepted' | 'driver_arriving' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled'
  estimated_price?: number
  final_price?: number
  estimated_duration_minutes?: number
  distance_km?: number
  requested_at: string
  accepted_at?: string
  started_at?: string
  completed_at?: string
  cancelled_at?: string
  passenger_comment?: string
  driver_comment?: string
  passenger_rating?: number
  driver_rating?: number
  payment_method?: 'cash' | 'card' | 'pix'
  payment_status?: string
}

export interface PassengerProfile {
  id: string
  full_name: string
  phone: string
}

export interface RideWithPassenger extends Ride {
  passenger: PassengerProfile
}

export const useRides = () => {
  const [rides, setRides] = useState<RideWithPassenger[]>([])
  const [currentRide, setCurrentRide] = useState<RideWithPassenger | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Fetch rides for current user
  const fetchRides = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          passenger:profiles!rides_passenger_id_fkey(
            id,
            full_name,
            phone
          )
        `)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('Error fetching rides:', error)
        toast({
          title: "Erro",
          description: "Erro ao carregar corridas",
          variant: "destructive"
        })
        return
      }

      const ridesWithPassenger = data?.map(ride => ({
        ...ride,
        passenger: Array.isArray(ride.passenger) ? ride.passenger[0] : ride.passenger
      })).filter(ride => ride.passenger && !ride.passenger.error) as RideWithPassenger[]

      setRides(ridesWithPassenger || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Accept a ride (driver)
  const acceptRide = useCallback(async (rideId: string) => {
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          driver_id: (await supabase.auth.getUser()).data.user?.id,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', rideId)

      if (error) throw error

      toast({
        title: "Corrida aceita!",
        description: "Você aceitou a corrida. Dirija-se ao local de embarque."
      })

      fetchRides()
    } catch (error) {
      console.error('Error accepting ride:', error)
      toast({
        title: "Erro",
        description: "Erro ao aceitar corrida",
        variant: "destructive"
      })
    }
  }, [toast, fetchRides])

  // Update ride status
  const updateRideStatus = useCallback(async (rideId: string, status: Ride['status']) => {
    try {
      const updateData: any = { status }
      
      // Add timestamp for specific statuses
      const now = new Date().toISOString()
      switch (status) {
        case 'driver_arriving':
          updateData.accepted_at = now
          break
        case 'driver_arrived':
          updateData.pickup_arrived_at = now
          break
        case 'in_progress':
          updateData.started_at = now
          break
        case 'completed':
          updateData.completed_at = now
          break
        case 'cancelled':
          updateData.cancelled_at = now
          break
      }

      const { error } = await supabase
        .from('rides')
        .update(updateData)
        .eq('id', rideId)

      if (error) throw error

      fetchRides()
      
      // Update current ride if it's the same
      if (currentRide?.id === rideId) {
        setCurrentRide(prev => prev ? { ...prev, status, ...updateData } : null)
      }

      const statusMessages = {
        'driver_arriving': 'Status atualizado: A caminho do passageiro',
        'driver_arrived': 'Status atualizado: Chegou ao local de embarque',
        'in_progress': 'Corrida iniciada!',
        'completed': 'Corrida finalizada!',
        'cancelled': 'Corrida cancelada'
      }

      toast({
        title: "Status atualizado",
        description: statusMessages[status] || "Status da corrida atualizado"
      })

    } catch (error) {
      console.error('Error updating ride status:', error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da corrida",
        variant: "destructive"
      })
    }
  }, [toast, fetchRides, currentRide])

  // Create a new ride request (passenger)
  const createRide = useCallback(async (rideData: {
    origin: LocationCoords
    destination: LocationCoords
    origin_address: string
    destination_address: string
    estimated_price?: number
    estimated_duration_minutes?: number
    distance_km?: number
  }) => {
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('rides')
        .insert({
          passenger_id: user.id,
          origin_lat: rideData.origin.lat,
          origin_lng: rideData.origin.lng,
          destination_lat: rideData.destination.lat,
          destination_lng: rideData.destination.lng,
          origin_address: rideData.origin_address,
          destination_address: rideData.destination_address,
          estimated_price: rideData.estimated_price,
          estimated_duration_minutes: rideData.estimated_duration_minutes,
          distance_km: rideData.distance_km,
          status: 'requested'
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Corrida solicitada!",
        description: "Sua corrida foi solicitada. Aguarde um motorista aceitar."
      })

      return data
    } catch (error) {
      console.error('Error creating ride:', error)
      toast({
        title: "Erro",
        description: "Erro ao solicitar corrida",
        variant: "destructive"
      })
      throw error
    }
  }, [toast])

  // Set current active ride
  const setActiveRide = useCallback((ride: RideWithPassenger | null) => {
    setCurrentRide(ride)
  }, [])

  useEffect(() => {
    fetchRides()
  }, [fetchRides])

  return {
    rides,
    currentRide,
    loading,
    fetchRides,
    acceptRide,
    updateRideStatus,
    createRide,
    setActiveRide
  }
}

// Hook for real-time ride notifications (for drivers)
export const useDriverRideNotifications = () => {
  const [pendingRides, setPendingRides] = useState<RideWithPassenger[]>([])
  const [isListening, setIsListening] = useState(false)
  const { toast } = useToast()

  const startListening = useCallback(() => {
    if (isListening) return

    setIsListening(true)
    
    // Subscribe to real-time changes for new ride requests
    const channel = supabase
      .channel('ride-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: 'status=eq.requested'
        },
        async (payload) => {
          const newRide = payload.new as Ride

          // Fetch passenger details
          const { data: passengerData } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('user_id', newRide.passenger_id)
            .single()

          if (passengerData) {
            const rideWithPassenger = {
              ...newRide,
              passenger: passengerData
            } as RideWithPassenger

            setPendingRides(prev => [rideWithPassenger, ...prev])
            
            // Show notification
            toast({
              title: "Nova corrida disponível!",
              description: `De: ${newRide.origin_address}\nPara: ${newRide.destination_address}`,
              duration: 10000
            })

            // Play notification sound (if available)
            try {
              const audio = new Audio('/notification.mp3')
              audio.play().catch(() => {
                // Fallback: browser notification sound
                console.log('🔔 Nova corrida!')
              })
            } catch (error) {
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
          table: 'rides'
        },
        (payload) => {
          const updatedRide = payload.new as Ride
          
          // Remove from pending if accepted by someone else
          if (updatedRide.status !== 'requested') {
            setPendingRides(prev => prev.filter(ride => ride.id !== updatedRide.id))
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
    setPendingRides([])
  }, [])

  const removePendingRide = useCallback((rideId: string) => {
    setPendingRides(prev => prev.filter(ride => ride.id !== rideId))
  }, [])

  return {
    pendingRides,
    isListening,
    startListening,
    stopListening,
    removePendingRide
  }
}