// Shared types between frontend and backend
export type { Database } from './database';

// Common enums
export const UserTypes = {
  PASSENGER: 'passenger',
  DRIVER: 'driver',
  ADMIN: 'admin'
} as const;

export const RideStatus = {
  PENDING: 'pending',
  DRIVER_ASSIGNED: 'driver_assigned', 
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const DriverStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected'
} as const;

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: 'success' | 'error';
}

// Location types
export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface Address {
  formatted_address: string;
  place_id: string;
  coordinates: LocationCoords;
}

// Common validation schemas
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}