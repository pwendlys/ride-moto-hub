// Rides service layer
import { supabase } from "@/integrations/supabase/client";
import BaseApiService from "./api";
import type { ApiResponse } from "../../../shared/types";

export interface CreateRideData {
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  estimated_price?: number;
  distance_km?: number;
  estimated_duration_minutes?: number;
}

export interface RideData {
  id: string;
  passenger_id: string;
  driver_id?: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  status: string;
  estimated_price?: number;
  final_price?: number;
  distance_km?: number;
  estimated_duration_minutes?: number;
  created_at: string;
  updated_at: string;
}

class RidesService extends BaseApiService {
  /**
   * Create a new ride request
   */
  async createRide(rideData: CreateRideData): Promise<ApiResponse<RideData>> {
    return this.handleRequest(async () => {
      const { data, error } = await supabase
        .from('rides')
        .insert([rideData])
        .select()
        .single();

      return { data, error };
    });
  }

  /**
   * Get ride by ID
   */
  async getRide(id: string): Promise<ApiResponse<RideData>> {
    return this.handleRequest(async () => {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', id)
        .single();

      return { data, error };
    });
  }

  /**
   * Get user's rides
   */
  async getUserRides(userId: string): Promise<ApiResponse<RideData[]>> {
    return this.handleRequest(async () => {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('passenger_id', userId)
        .order('created_at', { ascending: false });

      return { data, error };
    });
  }

  /**
   * Update ride status
   */
  async updateRideStatus(
    rideId: string, 
    status: string, 
    driverId?: string
  ): Promise<ApiResponse<RideData>> {
    return this.handleRequest(async () => {
      const updateData: any = { status };
      if (driverId) updateData.driver_id = driverId;

      const { data, error } = await supabase
        .from('rides')
        .update(updateData)
        .eq('id', rideId)
        .select()
        .single();

      return { data, error };
    });
  }

  /**
   * Cancel ride
   */
  async cancelRide(rideId: string): Promise<ApiResponse<RideData>> {
    return this.updateRideStatus(rideId, 'cancelled');
  }

  /**
   * Request nearby drivers for a ride
   */
  async requestDrivers(rideId: string): Promise<ApiResponse<any>> {
    return this.callEdgeFunction('ride-queue-manager', { ride_id: rideId });
  }
}

export const ridesService = new RidesService();