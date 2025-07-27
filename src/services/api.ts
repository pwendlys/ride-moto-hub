// Centralized API service layer
import { supabase } from "@/integrations/supabase/client";
import type { ApiResponse } from "../../../shared/types";

/**
 * Base API class with common functionality
 */
class BaseApiService {
  protected async handleRequest<T>(
    operation: () => Promise<any>
  ): Promise<ApiResponse<T>> {
    try {
      const result = await operation();
      
      if (result.error) {
        return {
          status: 'error',
          error: result.error.message || 'An error occurred',
          data: null
        };
      }
      
      return {
        status: 'success',
        data: result.data
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null
      };
    }
  }

  protected async callEdgeFunction<T>(
    functionName: string, 
    payload?: any
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) {
        return {
          status: 'error',
          error: error.message,
          data: null
        };
      }

      return {
        status: 'success',
        data
      };
    } catch (error) {
      console.error(`Edge Function ${functionName} Error:`, error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Function call failed',
        data: null
      };
    }
  }
}

export default BaseApiService;