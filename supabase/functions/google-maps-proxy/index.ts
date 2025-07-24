import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🗺️ google-maps-proxy function called!', { method: req.method, url: req.url })
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    console.error('❌ No authorization header provided')
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Authentication required' }),
      { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Verify JWT token
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  
  if (authError || !user) {
    console.error('❌ Invalid authentication token:', authError)
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid token' }),
      { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('✅ User authenticated:', user.id)

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { action, ...params } = await req.json();

    let googleMapsUrl: string;
    let queryParams: URLSearchParams;

    switch (action) {
      case 'places-autocomplete':
        googleMapsUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
        queryParams = new URLSearchParams({
          key: apiKey,
          input: params.input || '',
          components: 'country:br', // Restrict to Brazil
          language: 'pt-BR',
        });
        break;

      case 'place-details':
        googleMapsUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
        queryParams = new URLSearchParams({
          key: apiKey,
          place_id: params.place_id || '',
          fields: 'geometry,formatted_address,name',
          language: 'pt-BR',
        });
        break;

      case 'directions':
        googleMapsUrl = 'https://maps.googleapis.com/maps/api/directions/json';
        queryParams = new URLSearchParams({
          key: apiKey,
          origin: params.origin || '',
          destination: params.destination || '',
          mode: 'driving',
          language: 'pt-BR',
          region: 'br',
        });
        break;

      case 'reverse-geocode':
        googleMapsUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
        queryParams = new URLSearchParams({
          key: apiKey,
          latlng: `${params.lat},${params.lng}`,
          language: 'pt-BR',
          region: 'br',
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    const fullUrl = `${googleMapsUrl}?${queryParams.toString()}`;
    console.log(`Making request to: ${action} - ${fullUrl}`);

    const response = await fetch(fullUrl);
    const data = await response.json();

    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      console.error('Google Maps API error:', data);
      return new Response(
        JSON.stringify({ 
          error: 'Google Maps API error', 
          details: data.error_message || data.status 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in Google Maps proxy:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})