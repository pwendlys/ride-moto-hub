import { z } from "zod";

// Coordinate validation schema
export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Ride validation schema
export const rideRequestSchema = z.object({
  origin_lat: z.number().min(-90).max(90),
  origin_lng: z.number().min(-180).max(180),
  destination_lat: z.number().min(-90).max(90),
  destination_lng: z.number().min(-180).max(180),
  origin_address: z.string().min(1).max(500),
  destination_address: z.string().min(1).max(500),
  estimated_price: z.number().positive().max(10000).optional(),
  distance_km: z.number().positive().max(1000).optional(),
  estimated_duration_minutes: z.number().positive().max(1440).optional(),
});

// Driver location validation schema
export const driverLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10000).optional(),
  speed: z.number().min(0).max(300).optional(),
  heading: z.number().min(0).max(360).optional(),
  is_online: z.boolean(),
});

// System settings validation schema
export const systemSettingsSchema = z.object({
  fixed_rate: z.number().positive().max(1000),
  price_per_km: z.number().positive().max(100),
  minimum_fare: z.number().positive().max(500),
  app_fee_percentage: z.number().min(0).max(50),
  pricing_model: z.enum(['per_km', 'fixed']),
  fee_type: z.enum(['percentage', 'fixed_amount']),
});

// User profile validation schema
export const profileSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  user_type: z.enum(['passenger', 'driver', 'admin']),
});

// Driver data validation schema
export const driverDataSchema = z.object({
  cnh: z.string().min(5).max(20),
  vehicle_brand: z.string().min(2).max(50),
  vehicle_model: z.string().min(2).max(50),
  vehicle_plate: z.string().min(7).max(10),
  vehicle_color: z.string().min(2).max(30),
  vehicle_type: z.enum(['motorcycle', 'car']),
});

// Authentication validation schemas
export const signInSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signUpSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  user_type: z.enum(['passenger', 'driver']),
});

// Sanitization helpers
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const sanitizeCoordinates = (lat: number, lng: number) => {
  return {
    lat: Math.max(-90, Math.min(90, lat)),
    lng: Math.max(-180, Math.min(180, lng)),
  };
};

// Validation result type
export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Generic validation function
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> => {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Validation failed" };
    }
    return { success: false, error: "Unknown validation error" };
  }
};