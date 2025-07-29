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
    const { record } = await req.json()
    console.log('🚗 New ride created via webhook:', record)

    // Only process rides with status 'requested'
    if (record.status !== 'requested') {
      console.log('⚠️ Ride status is not "requested", skipping queue processing')
      return new Response(
        JSON.stringify({ success: true, message: 'Ride status not eligible for queue processing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call ride-queue-manager function
    console.log(`🔔 Triggering ride queue manager for ride: ${record.id}`)
    
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ride-queue-manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({ rideId: record.id })
    })

    const result = await response.json()
    
    if (!response.ok) {
      console.error('❌ Error calling ride-queue-manager:', result)
      throw new Error(`Ride queue manager failed: ${result.error || 'Unknown error'}`)
    }

    console.log('✅ Ride queue manager called successfully:', result)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Ride queue processing triggered',
        rideId: record.id,
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in trigger function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})