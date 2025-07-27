import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useLocationTracking, LocationCoords } from './useGeolocation'

interface DriverLocation {
  id: string
  driver_id: string
  lat: number
  lng: number
  heading?: number
  speed?: number
  accuracy?: number
  is_online: boolean
  last_update: string
}

export const useDriverLocation = (enabled = false) => {
  const locationData = useLocationTracking(enabled, 3000) // Update every 3 seconds
  const [isOnline, setIsOnline] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Update driver location in database
  const updateLocation = async (coords: LocationCoords, additionalData?: {
    heading?: number
    speed?: number
    accuracy?: number
  }) => {
    if (isUpdating) return

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: (await supabase.auth.getUser()).data.user?.id,
          lat: coords.lat,
          lng: coords.lng,
          heading: additionalData?.heading,
          speed: additionalData?.speed,
          accuracy: additionalData?.accuracy,
          is_online: isOnline,
          last_update: new Date().toISOString(),
        })

      if (error) {
        console.error('Erro ao atualizar localização:', error)
      }
    } catch (error) {
      console.error('Erro ao atualizar localização:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  // Auto-update location when tracking is enabled and location changes
  useEffect(() => {
    if (enabled && locationData.coords && isOnline) {
      updateLocation(locationData.coords, {
        accuracy: locationData.accuracy || undefined,
      })
    }
  }, [locationData.coords, enabled, isOnline])

  const setOnlineStatus = async (online: boolean) => {
    setIsOnline(online)
    
    if (locationData.coords) {
      await updateLocation(locationData.coords, {
        accuracy: locationData.accuracy || undefined,
      })
    }

    // If going offline, update the status immediately
    if (!online) {
      try {
        const { error } = await supabase
          .from('driver_locations')
          .update({ is_online: false })
          .eq('driver_id', (await supabase.auth.getUser()).data.user?.id)

        if (error) {
          console.error('Erro ao atualizar status offline:', error)
        }
      } catch (error) {
        console.error('Erro ao atualizar status offline:', error)
      }
    }
  }

  return {
    location: locationData,
    isOnline,
    isUpdating,
    setOnlineStatus,
    updateLocation,
  }
}

export const useNearbyDrivers = (passengerLocation?: LocationCoords, radius = 10) => {
  const [drivers, setDrivers] = useState<DriverLocation[]>([])
  const [loading, setLoading] = useState(false)

  const loadNearbyDrivers = async () => {
    if (!passengerLocation) return

    setLoading(true)
    try {
      // For now, get all online drivers
      // In a production app, you'd want to filter by location using PostGIS
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('is_online', true)
        .gte('last_update', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes

      if (error) throw error

      // Simple distance calculation (in a real app, use PostGIS ST_DWithin)
      const nearbyDrivers = data?.filter(driver => {
        const distance = calculateDistance(
          passengerLocation,
          { lat: driver.lat, lng: driver.lng }
        )
        return distance <= radius
      }) || []

      setDrivers(nearbyDrivers)
    } catch (error) {
      console.error('Erro ao carregar motoristas próximos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNearbyDrivers()
  }, [passengerLocation, radius])

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('driver-locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
        },
        () => {
          loadNearbyDrivers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [passengerLocation])

  return { drivers, loading, refreshDrivers: loadNearbyDrivers }
}

// Helper function to calculate distance between two points
const calculateDistance = (point1: LocationCoords, point2: LocationCoords): number => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (point2.lat - point1.lat) * Math.PI / 180
  const dLon = (point2.lng - point1.lng) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}