# API Documentation

## Services Overview

A plataforma utiliza uma arquitetura de camada de serviços que centraliza toda comunicação com APIs externas e backend.

## Frontend Services

### AuthService (`frontend/src/services/auth.ts`)

Gerencia autenticação e autorização de usuários.

#### Methods

```typescript
// Sign up new user
await authService.signUp({
  email: "user@example.com",
  password: "password123",
  userData: {
    full_name: "João Silva",
    phone: "+5511999999999",
    user_type: "passenger"
  }
});

// Sign in user
await authService.signIn("user@example.com", "password123");

// Sign out
await authService.signOut();

// Get current session
await authService.getSession();

// Get current user
await authService.getCurrentUser();
```

### RidesService (`frontend/src/services/rides.ts`)

Gerencia corridas e solicitações de transporte.

#### Methods

```typescript
// Create new ride
await ridesService.createRide({
  origin_address: "Rua A, 123",
  origin_lat: -23.550520,
  origin_lng: -46.633308,
  destination_address: "Rua B, 456",
  destination_lat: -23.561684,
  destination_lng: -46.625378,
  estimated_price: 15.50,
  distance_km: 3.2
});

// Get ride by ID
await ridesService.getRide("ride-id");

// Get user's rides
await ridesService.getUserRides("user-id");

// Update ride status
await ridesService.updateRideStatus("ride-id", "in_progress", "driver-id");

// Cancel ride
await ridesService.cancelRide("ride-id");

// Request drivers
await ridesService.requestDrivers("ride-id");
```

### MapsService (`frontend/src/services/maps.ts`)

Integração com Google Maps API.

#### Methods

```typescript
// Get API key (internal)
await mapsService.getApiKey();

// Initialize Google Maps
await mapsService.loadGoogleMaps();

// Calculate route
await mapsService.calculateRoute(
  { lat: -23.550520, lng: -46.633308 },
  { lat: -23.561684, lng: -46.625378 }
);

// Geocode address
await mapsService.geocodeAddress("Avenida Paulista, São Paulo");

// Get current location
await mapsService.getCurrentLocation();
```

## Backend Edge Functions

### get-maps-key

Fornece chave de API do Google Maps de forma segura.

**Endpoint:** `POST /functions/v1/get-maps-key`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Response:**
```json
{
  "apiKey": "AIza...",
  "timestamp": "2024-01-15T10:30:00Z",
  "status": "success"
}
```

### ride-queue-manager

Gerencia fila de motoristas para corridas.

**Endpoint:** `POST /functions/v1/ride-queue-manager`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "ride_id": "uuid-v4"
}
```

**Response:**
```json
{
  "success": true,
  "drivers_notified": 3,
  "estimated_wait_time": "2-5 minutes"
}
```

### google-maps-proxy

Proxy para APIs do Google Maps.

**Endpoint:** `POST /functions/v1/google-maps-proxy`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "service": "directions",
  "params": {
    "origin": "-23.550520,-46.633308",
    "destination": "-23.561684,-46.625378",
    "mode": "driving"
  }
}
```

## Response Format

Todos os serviços retornam respostas no formato padrão:

```typescript
interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  message?: string;
}
```

## Error Handling

### Frontend
```typescript
const result = await ridesService.createRide(rideData);

if (result.status === 'error') {
  console.error('Error:', result.error);
  // Show user-friendly error message
} else {
  console.log('Success:', result.data);
  // Handle successful response
}
```

### Error Codes

#### Authentication Errors
- `MISSING_AUTH_HEADER` - No authorization header
- `TOKEN_EXPIRED` - JWT token expired
- `INVALID_TOKEN` - Invalid JWT token
- `USER_NOT_FOUND` - User not found after auth

#### Maps Errors
- `API_KEY_NOT_CONFIGURED` - Google Maps key missing
- `MAPS_API_ERROR` - Google Maps API error
- `GEOCODING_FAILED` - Address not found
- `ROUTE_NOT_FOUND` - No route between points

#### Ride Errors
- `INVALID_COORDINATES` - Invalid lat/lng values
- `NO_DRIVERS_AVAILABLE` - No drivers in area
- `RIDE_NOT_FOUND` - Ride ID not found
- `UNAUTHORIZED_ACCESS` - User cannot access ride

## Rate Limiting

- **Edge Functions**: 100 requests/minute per user
- **Google Maps**: Quota managed via Google Cloud
- **Database**: RLS policies enforce access control

## Authentication

Todas as APIs protegidas requerem JWT token nos headers:

```javascript
headers: {
  'Authorization': `Bearer ${supabase.auth.session()?.access_token}`,
  'Content-Type': 'application/json'
}
```

## Development

### Testing APIs

```bash
# Start local development
cd frontend && npm run dev
cd backend && npm run start

# Test Edge Functions
curl -X POST http://localhost:54321/functions/v1/get-maps-key \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Monitoring

- **Frontend**: Browser DevTools Network tab
- **Backend**: Supabase Dashboard → Functions → Logs
- **Database**: Supabase Dashboard → SQL Editor

Para mais detalhes sobre a arquitetura, consulte [ARCHITECTURE.md](./ARCHITECTURE.md).