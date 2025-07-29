import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      rides: any
      ride_notifications: any
      driver_locations: any
      profiles: any
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { rideId } = await req.json()
    console.log(`🚗 Processing ride queue for ride: ${rideId}`)

    // Buscar a corrida
    const { data: ride, error: rideError } = await supabaseClient
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .eq('status', 'requested')
      .single()

    if (rideError || !ride) {
      console.log(`❌ Ride not found or already processed: ${rideId}`)
      return new Response(
        JSON.stringify({ success: false, message: 'Ride not found or already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calcular motoristas próximos ordenados por distância
    const nearbyDrivers = await findNearbyDrivers(supabaseClient, ride.origin_lat, ride.origin_lng)
    
    if (nearbyDrivers.length === 0) {
      console.log(`❌ No drivers available for ride: ${rideId}`)
      return new Response(
        JSON.stringify({ success: false, message: 'No drivers available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar notificações broadcast para todos os motoristas simultaneamente
    await createBroadcastNotifications(supabaseClient, rideId, nearbyDrivers)

    console.log(`✅ Created broadcast notifications for ${nearbyDrivers.length} drivers for ride: ${rideId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        driversNotified: nearbyDrivers.length,
        rideId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in ride queue manager:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function findNearbyDrivers(supabaseClient: any, originLat: number, originLng: number) {
  // Buscar motoristas online dos últimos 2 minutos
  const { data: drivers, error } = await supabaseClient
    .from('driver_locations')
    .select('driver_id, lat, lng')
    .eq('is_online', true)
    .gte('last_update', new Date(Date.now() - 2 * 60 * 1000).toISOString())

  if (error || !drivers) {
    console.error('Error fetching nearby drivers:', error)
    return []
  }

  // Calcular distâncias e ordenar
  const driversWithDistance = drivers.map((driver: any) => ({
    ...driver,
    distance: calculateDistance(
      { lat: originLat, lng: originLng },
      { lat: driver.lat, lng: driver.lng }
    )
  }))
  .filter((driver: any) => driver.distance <= 10) // Máximo 10km
  .sort((a: any, b: any) => a.distance - b.distance)
  .slice(0, 5) // Máximo 5 motoristas

  console.log(`📍 Found ${driversWithDistance.length} nearby drivers`)
  return driversWithDistance
}

async function createBroadcastNotifications(supabaseClient: any, rideId: string, drivers: any[]) {
  console.log(`📢 Creating broadcast notifications for ${drivers.length} drivers`)
  
  // Criar notificações simultâneas para todos os motoristas (sem conceito de fila)
  const notifications = drivers.map((driver) => ({
    ride_id: rideId,
    driver_id: driver.driver_id,
    distance_km: driver.distance,
    status: 'pending'
  }))

  const { error } = await supabaseClient
    .from('ride_notifications')
    .insert(notifications)

  if (error) {
    console.error('Error creating broadcast notifications:', error)
    throw error
  }

  console.log(`✅ Created ${notifications.length} broadcast notifications`)
  
  // Configurar timeout global de 50 segundos para toda a corrida
  setTimeout(async () => {
    await handleRideTimeout(supabaseClient, rideId)
  }, 50000)
}

async function handleRideTimeout(supabaseClient: any, rideId: string) {
  console.log(`⏰ Checking ride timeout for: ${rideId}`)
  
  // Verificar se a corrida ainda está disponível
  const { data: ride } = await supabaseClient
    .from('rides')
    .select('status')
    .eq('id', rideId)
    .single()

  if (ride?.status === 'requested') {
    console.log(`⏰ Ride ${rideId} expired after 50 seconds - marking as expired`)
    
    // Marcar todas as notificações como expiradas
    await supabaseClient
      .from('ride_notifications')
      .update({ status: 'expired' })
      .eq('ride_id', rideId)
      .eq('status', 'pending')
    
    console.log(`❌ Ride ${rideId} broadcast expired - all notifications marked as expired`)
  } else {
    console.log(`⏰ Ride ${rideId} no longer needs timeout processing - status: ${ride?.status}`)
  }
}

function calculateDistance(point1: {lat: number, lng: number}, point2: {lat: number, lng: number}): number {
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