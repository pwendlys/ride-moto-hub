export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      driver_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          driver_id: string
          heading: number | null
          id: string
          is_online: boolean
          last_update: string
          lat: number
          lng: number
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          driver_id: string
          heading?: number | null
          id?: string
          is_online?: boolean
          last_update?: string
          lat: number
          lng: number
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          is_online?: boolean
          last_update?: string
          lat?: number
          lng?: number
          speed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          cnh: string
          created_at: string
          id: string
          rating: number | null
          status: Database["public"]["Enums"]["driver_status"]
          total_rides: number | null
          updated_at: string
          user_id: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_model: string
          vehicle_plate: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          cnh: string
          created_at?: string
          id?: string
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number | null
          updated_at?: string
          user_id: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_model: string
          vehicle_plate: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          cnh?: string
          created_at?: string
          id?: string
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number | null
          updated_at?: string
          user_id?: string
          vehicle_brand?: string
          vehicle_color?: string
          vehicle_model?: string
          vehicle_plate?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      financial_transfers: {
        Row: {
          app_fee: number
          created_at: string
          driver_amount: number
          driver_id: string
          id: string
          ride_id: string
          ride_value: number
          transfer_status: string | null
          updated_at: string
        }
        Insert: {
          app_fee: number
          created_at?: string
          driver_amount: number
          driver_id: string
          id?: string
          ride_id: string
          ride_value: number
          transfer_status?: string | null
          updated_at?: string
        }
        Update: {
          app_fee?: number
          created_at?: string
          driver_amount?: number
          driver_id?: string
          id?: string
          ride_id?: string
          ride_value?: number
          transfer_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transfers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone: string
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      rides: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          distance_km: number | null
          driver_comment: string | null
          driver_id: string | null
          driver_rating: number | null
          estimated_duration_minutes: number | null
          estimated_price: number | null
          final_price: number | null
          id: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          passenger_comment: string | null
          passenger_id: string
          passenger_rating: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: string | null
          requested_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          distance_km?: number | null
          driver_comment?: string | null
          driver_id?: string | null
          driver_rating?: number | null
          estimated_duration_minutes?: number | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          passenger_comment?: string | null
          passenger_id: string
          passenger_rating?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: string | null
          requested_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          distance_km?: number | null
          driver_comment?: string | null
          driver_id?: string | null
          driver_rating?: number | null
          estimated_duration_minutes?: number | null
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          origin_address?: string
          origin_lat?: number
          origin_lng?: number
          passenger_comment?: string | null
          passenger_id?: string
          passenger_rating?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: string | null
          requested_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          app_fee_percentage: number
          created_at: string
          fee_type: string
          fixed_rate: number
          id: string
          minimum_fare: number
          price_per_km: number
          pricing_model: string
          updated_at: string
        }
        Insert: {
          app_fee_percentage?: number
          created_at?: string
          fee_type?: string
          fixed_rate?: number
          id?: string
          minimum_fare?: number
          price_per_km?: number
          pricing_model?: string
          updated_at?: string
        }
        Update: {
          app_fee_percentage?: number
          created_at?: string
          fee_type?: string
          fixed_rate?: number
          id?: string
          minimum_fare?: number
          price_per_km?: number
          pricing_model?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      validate_coordinates: {
        Args: { lat: number; lng: number }
        Returns: boolean
      }
      validate_pricing_settings: {
        Args: {
          fixed_rate_val: number
          price_per_km_val: number
          minimum_fare_val: number
          app_fee_percentage_val: number
        }
        Returns: boolean
      }
    }
    Enums: {
      driver_status: "pending" | "approved" | "rejected" | "suspended"
      payment_method: "cash" | "card" | "pix"
      ride_status:
        | "requested"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_type: "passenger" | "driver" | "admin"
      vehicle_type: "motorcycle" | "car"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      driver_status: ["pending", "approved", "rejected", "suspended"],
      payment_method: ["cash", "card", "pix"],
      ride_status: [
        "requested",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_type: ["passenger", "driver", "admin"],
      vehicle_type: ["motorcycle", "car"],
    },
  },
} as const
