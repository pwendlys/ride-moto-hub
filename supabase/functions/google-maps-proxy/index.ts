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

  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ Invalid authentication token:', authError)
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized - Invalid token',
          authError: authError?.message || 'Token validation failed',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('✅ User authenticated:', user.id)
    
  } catch (authErrorCatch) {
    console.error('❌ Authentication error:', authErrorCatch)
    return new Response(
      JSON.stringify({ 
        error: 'Authentication failed',
        details: authErrorCatch.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const backendApiKey = Deno.env.get('GOOGLE_MAPS_BACKEND_API_KEY');
    
    if (!backendApiKey) {
      console.error('❌ GOOGLE_MAPS_BACKEND_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ 
          error: 'Google Maps backend API key not configured',
          timestamp: new Date().toISOString(),
          action: 'check_environment_variables'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Backend API key found, processing action...')

    const { action, ...params } = await req.json();

    let googleMapsUrl: string;
    let queryParams: URLSearchParams;

    switch (action) {
      case 'places-autocomplete':
        googleMapsUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
        queryParams = new URLSearchParams({
          key: backendApiKey,
          input: params.input || '',
          components: 'country:br', // Restrict to Brazil
          language: 'pt-BR',
        });
        break;

      case 'place-details':
        googleMapsUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
        queryParams = new URLSearchParams({
          key: backendApiKey,
          place_id: params.place_id || '',
          fields: 'geometry,formatted_address,name',
          language: 'pt-BR',
        });
        break;

      case 'directions':
        googleMapsUrl = 'https://maps.googleapis.com/maps/api/directions/json';
        queryParams = new URLSearchParams({
          key: backendApiKey,
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
          key: backendApiKey,
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
    console.log(`🔄 Making ${action} request...`);
    console.log(`📍 URL (without key): ${googleMapsUrl}?${queryParams.toString().replace(/key=[^&]+/, 'key=***')}`);

    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      console.error(`❌ HTTP Error ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error(`❌ Response body: ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: errorText,
          action: action,
          timestamp: new Date().toISOString()
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log(`📊 Response status: ${data.status || 'unknown'}`);

    if (data.status === 'REQUEST_DENIED') {
      const requiredApis = getRequiredApis(action);
      console.error('❌ Google Maps API - REQUEST DENIED:', {
        status: data.status,
        error_message: data.error_message,
        action: action,
        requiredApis: requiredApis
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Google Maps API access denied', 
          details: data.error_message || 'API key may be invalid or missing permissions',
          status: data.status,
          action: action,
          requiredApis: requiredApis,
          timestamp: new Date().toISOString(),
          suggestions: [
            `Enable these APIs: ${requiredApis.join(', ')}`,
            'Check domain restrictions (Edge Functions need IP or no restrictions)',
            'Verify API quotas and billing are active',
            'Check if key is restricted to wrong referrers'
          ]
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (data.status === 'INVALID_REQUEST' || data.status === 'ZERO_RESULTS') {
      console.error('❌ Google Maps API - Invalid request:', {
        status: data.status,
        error_message: data.error_message,
        action: action,
        params: Object.fromEntries(queryParams)
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request to Google Maps API', 
          details: data.error_message || data.status,
          status: data.status,
          action: action,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (data.status && data.status !== 'OK') {
      console.warn(`⚠️ Google Maps API warning - Status: ${data.status}`, data);
    }

    console.log(`✅ ${action} completed successfully`)

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Critical error in Google Maps proxy:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent'),
      action: 'unknown'
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})

// Helper function to identify required APIs based on action
function getRequiredApis(action: string): string[] {
  const apiMap: Record<string, string[]> = {
    'places-autocomplete': ['Places API (New)'],
    'place-details': ['Places API (New)'],
    'directions': ['Directions API'],
    'reverse-geocode': ['Geocoding API']
  };
  
  return apiMap[action] || ['Unknown API'];
}