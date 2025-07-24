import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    
    if (!googleMapsApiKey) {
      throw new Error('Google Maps API key not configured')
    }

    let url: string
    let response: Response

    switch (action) {
      case 'geocode':
        // Convert address to coordinates
        url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(params.address)}&key=${googleMapsApiKey}`
        break
        
      case 'reverse-geocode':
        // Convert coordinates to address
        url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${params.lat},${params.lng}&key=${googleMapsApiKey}`
        break
        
      case 'directions':
        // Get directions between two points
        url = `https://maps.googleapis.com/maps/api/directions/json?origin=${params.origin}&destination=${params.destination}&key=${googleMapsApiKey}`
        break
        
      case 'places-autocomplete':
        // Places autocomplete for address search
        url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(params.input)}&key=${googleMapsApiKey}`
        break
        
      case 'place-details':
        // Get place details by place_id
        url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${params.place_id}&fields=geometry,formatted_address&key=${googleMapsApiKey}`
        break
        
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    response = await fetch(url)
    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Google Maps proxy error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})