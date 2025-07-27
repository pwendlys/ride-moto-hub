// Maps service layer
import { Loader } from "@googlemaps/js-api-loader";
import { supabase } from "@/integrations/supabase/client";
import BaseApiService from "./api";
import type { ApiResponse, LocationCoords } from "../../../shared/types";

export interface RouteResult {
  distance: number; // in kilometers
  duration: number; // in minutes
  polyline: string;
  bounds: google.maps.LatLngBounds;
}

export interface PlaceResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: LocationCoords;
  };
}

class MapsService extends BaseApiService {
  private apiKey: string | null = null;
  private loader: Loader | null = null;

  /**
   * Get Google Maps API key from backend
   */
  async getApiKey(): Promise<ApiResponse<string>> {
    if (this.apiKey) {
      return { status: 'success', data: this.apiKey };
    }

    const result = await this.callEdgeFunction<{apiKey: string}>('get-maps-key');
    
    if (result.status === 'success' && result.data?.apiKey) {
      this.apiKey = result.data.apiKey;
    }

    return {
      status: result.status,
      data: this.apiKey,
      error: result.error
    };
  }

  /**
   * Initialize Google Maps loader
   */
  async initializeLoader(): Promise<ApiResponse<Loader>> {
    if (this.loader) {
      return { status: 'success', data: this.loader };
    }

    const keyResult = await this.getApiKey();
    if (keyResult.status === 'error' || !keyResult.data) {
      return {
        status: 'error',
        error: keyResult.error || 'Failed to get API key',
        data: null
      };
    }

    this.loader = new Loader({
      apiKey: keyResult.data,
      version: "weekly",
      libraries: ["places", "geometry", "directions"]
    });

    return { status: 'success', data: this.loader };
  }

  /**
   * Load Google Maps API
   */
  async loadGoogleMaps(): Promise<ApiResponse<typeof google.maps>> {
    const loaderResult = await this.initializeLoader();
    if (loaderResult.status === 'error') {
      return loaderResult as any;
    }

    try {
      await loaderResult.data!.load();
      return { status: 'success', data: google.maps };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load Google Maps',
        data: null
      };
    }
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(
    origin: LocationCoords,
    destination: LocationCoords
  ): Promise<ApiResponse<RouteResult>> {
    const mapsResult = await this.loadGoogleMaps();
    if (mapsResult.status === 'error') {
      return mapsResult as any;
    }

    return this.handleRequest(async () => {
      const directionsService = new google.maps.DirectionsService();
      
      const result = await directionsService.route({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      });

      const leg = result.routes[0]?.legs[0];
      if (!leg) {
        throw new Error('No route found');
      }

      return {
        data: {
          distance: leg.distance?.value ? leg.distance.value / 1000 : 0, // Convert to km
          duration: leg.duration?.value ? leg.duration.value / 60 : 0,   // Convert to minutes
          polyline: result.routes[0].overview_polyline,
          bounds: result.routes[0].bounds
        },
        error: null
      };
    });
  }

  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address: string): Promise<ApiResponse<PlaceResult>> {
    const mapsResult = await this.loadGoogleMaps();
    if (mapsResult.status === 'error') {
      return mapsResult as any;
    }

    return this.handleRequest(async () => {
      const geocoder = new google.maps.Geocoder();
      
      const result = await geocoder.geocode({ address });
      
      if (!result.results[0]) {
        throw new Error('Address not found');
      }

      const place = result.results[0];
      
      return {
        data: {
          place_id: place.place_id,
          formatted_address: place.formatted_address,
          geometry: {
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            }
          }
        },
        error: null
      };
    });
  }

  /**
   * Get current user location
   */
  async getCurrentLocation(): Promise<ApiResponse<LocationCoords>> {
    return this.handleRequest(async () => {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      return {
        data: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined
        },
        error: null
      };
    });
  }
}

export const mapsService = new MapsService();