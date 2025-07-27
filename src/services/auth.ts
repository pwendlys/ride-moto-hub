// Authentication service layer
import { supabase } from "@/integrations/supabase/client";
import BaseApiService from "./api";
import type { ApiResponse } from "../../../shared/types";
import type { User, Session } from "@supabase/supabase-js";

export interface SignUpData {
  email: string;
  password: string;
  userData: {
    full_name: string;
    phone: string;
    user_type: 'passenger' | 'driver';
    cnh?: string;
    vehicle_brand?: string;
    vehicle_model?: string;
    vehicle_plate?: string;
    vehicle_color?: string;
    vehicle_type?: 'motorcycle' | 'car';
  };
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
}

class AuthService extends BaseApiService {
  /**
   * Sign up a new user
   */
  async signUp(data: SignUpData): Promise<ApiResponse<AuthResponse>> {
    const { email, password, userData } = data;
    
    return this.handleRequest(async () => {
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      return { data: authData, error };
    });
  }

  /**
   * Sign in user
   */
  async signIn(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    return this.handleRequest(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      return { data, error };
    });
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      const { error } = await supabase.auth.signOut();
      return { data: null, error };
    });
  }

  /**
   * Get current session
   */
  async getSession(): Promise<ApiResponse<Session>> {
    return this.handleRequest(async () => {
      const { data, error } = await supabase.auth.getSession();
      return { data: data.session, error };
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.handleRequest(async () => {
      const { data, error } = await supabase.auth.getUser();
      return { data: data.user, error };
    });
  }
}

export const authService = new AuthService();