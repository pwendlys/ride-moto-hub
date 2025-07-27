import { useState, useEffect } from 'react'

export interface LocationCoords {
  lat: number
  lng: number
}

export interface LocationState {
  coords: LocationCoords | null
  error: string | null
  loading: boolean
  accuracy: number | null
}

export const useGeolocation = (enableHighAccuracy = true, timeout = 10000) => {
  const [location, setLocation] = useState<LocationState>({
    coords: null,
    error: null,
    loading: true,
    accuracy: null,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: 'Geolocalização não é suportada pelo seu navegador',
        loading: false,
      }))
      return
    }

    const options: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge: 30000, // Cache por 30 segundos
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setLocation({
        coords: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        error: null,
        loading: false,
        accuracy: position.coords.accuracy,
      })
    }

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'Erro ao obter localização'
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de localização negada'
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Localização indisponível'
          break
        case error.TIMEOUT:
          errorMessage = 'Tempo limite para obter localização excedido'
          break
      }

      setLocation(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
    }

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options)
  }, [enableHighAccuracy, timeout])

  const refreshLocation = () => {
    setLocation(prev => ({ ...prev, loading: true, error: null }))
    
    const handleSuccess = (position: GeolocationPosition) => {
      setLocation({
        coords: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        error: null,
        loading: false,
        accuracy: position.coords.accuracy,
      })
    }

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'Erro ao obter localização'
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de localização negada'
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Localização indisponível'
          break
        case error.TIMEOUT:
          errorMessage = 'Tempo limite para obter localização excedido'
          break
      }

      setLocation(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
    }

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, { enableHighAccuracy, timeout, maximumAge: 0 })
  }

  return { ...location, refreshLocation }
}

export const useLocationTracking = (enabled = false, interval = 5000) => {
  const [location, setLocation] = useState<LocationState>({
    coords: null,
    error: null,
    loading: false,
    accuracy: null,
  })

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return

    let watchId: number

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: interval,
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setLocation({
        coords: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        error: null,
        loading: false,
        accuracy: position.coords.accuracy,
      })
    }

    const handleError = (error: GeolocationPositionError) => {
      setLocation(prev => ({
        ...prev,
        error: 'Erro no rastreamento de localização',
        loading: false,
      }))
    }

    watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options)

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [enabled, interval])

  return location
}