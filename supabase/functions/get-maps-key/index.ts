
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🔑 get-maps-key function called!', { method: req.method, url: req.url })
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ No authorization header provided')
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          code: 'MISSING_AUTH_HEADER'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔍 Authorization header present, verifying token...')

    // Create Supabase client with auth header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError) {
      console.error('❌ Authentication failed:', authError.message, 'Status:', authError.status)
      
      // Check if it's a token expiration error
      const isTokenExpired = authError.message?.includes('expired') || 
                            authError.message?.includes('invalid') ||
                            authError.status === 401

      return new Response(
        JSON.stringify({ 
          error: isTokenExpired ? 'Token expired' : 'Invalid authentication',
          code: isTokenExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          details: authError.message
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!user) {
      console.error('❌ No user found after successful auth')
      return new Response(
        JSON.stringify({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ User authenticated:', user.id)

    // Get Google Maps API key from environment
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!apiKey) {
      console.error('❌ GOOGLE_MAPS_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Google Maps API key not configured',
          details: 'Please configure GOOGLE_MAPS_API_KEY in Supabase secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ API key found, returning to client')
    return new Response(
      JSON.stringify({ apiKey }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Critical error in get-maps-key:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})
