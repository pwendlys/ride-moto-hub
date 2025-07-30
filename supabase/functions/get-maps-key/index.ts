
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

    // Get Google Maps frontend API key from environment
    const frontendApiKey = Deno.env.get('GOOGLE_MAPS_FRONTEND_API_KEY');
    
    console.log('🔍 Checking environment variables:', {
      hasFrontendKey: !!frontendApiKey,
      keyLength: frontendApiKey?.length || 0,
      keyPrefix: frontendApiKey?.substring(0, 10) || 'none'
    })
    
    if (!frontendApiKey) {
      console.error('❌ GOOGLE_MAPS_FRONTEND_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Google Maps frontend API key not configured',
          code: 'MISSING_API_KEY',
          details: 'Please configure GOOGLE_MAPS_FRONTEND_API_KEY in Supabase secrets',
          troubleshooting: [
            'Go to Supabase Dashboard > Settings > API',
            'Add GOOGLE_MAPS_FRONTEND_API_KEY to environment variables',
            'Ensure the API key has proper restrictions for your domain'
          ]
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate API key format
    if (frontendApiKey.length < 30) {
      console.error('❌ Frontend API key appears to be invalid (too short):', frontendApiKey.length);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid API key format',
          code: 'INVALID_API_KEY',
          details: 'API key appears to be too short - check configuration'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Frontend API key validated and ready to return')
    return new Response(
      JSON.stringify({ 
        apiKey: frontendApiKey,
        timestamp: new Date().toISOString(),
        success: true
      }),
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
