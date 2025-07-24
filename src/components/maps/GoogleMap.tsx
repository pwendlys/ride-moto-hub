import React, { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { LocationCoords } from '@/hooks/useGeolocation'
import { supabase } from '@/integrations/supabase/client'

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
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  useEffect(() => {
    const initMap = async () => {
      try {
        // Buscar a API key do Google Maps via edge function
        const { data: keyData, error: keyError } = await supabase.functions.invoke('get-maps-key')
        
        if (keyError || !keyData?.apiKey) {
          console.error('Erro ao obter API key:', keyError)
          return
        }

        const loader = new Loader({
          apiKey: keyData.apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry'],
        })

        await loader.load()
        
        if (mapRef.current) {
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
        }
      } catch (error) {
        console.error('Erro ao carregar Google Maps:', error)
      }
    }

    initMap()
  }, [center.lat, center.lng, zoom, onMapLoad, onLocationSelect, showRoute?.color])

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
        }
      }
    )
  }, [map, directionsService, directionsRenderer, showRoute])

  // Update map center
  useEffect(() => {
    if (map) {
      map.setCenter(center)
    }
  }, [map, center.lat, center.lng])

  return (
    <div
      ref={mapRef}
      style={{ height, width }}
      className={`rounded-lg border border-border ${className}`}
    />
  )
}