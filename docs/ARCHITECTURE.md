# Arquitetura da Plataforma MotoTaxi

## Visão Geral

A plataforma MotoTaxi é estruturada com separação clara entre frontend e backend, promovendo:
- **Escalabilidade** - Cada parte pode escalar independentemente
- **Manutenibilidade** - Código organizado e bem estruturado
- **Desenvolvimento** - Times podem trabalhar em paralelo
- **Deploy** - Deployments independentes e otimizados

## Estrutura de Diretórios

```
mototaxi-platform/
├── frontend/              # React Application
├── backend/               # Supabase Backend
├── shared/                # Shared Code
└── docs/                  # Documentation
```

## Frontend (React + TypeScript)

### Responsabilidades
- **UI/UX** - Interface responsiva e intuitiva
- **Estado Local** - Gerenciamento com React hooks
- **Navegação** - React Router para SPAs
- **Validação** - Formulários com Zod + React Hook Form
- **Maps** - Google Maps integration
- **API Consumption** - Camada de serviços

### Arquitetura Interna
```
frontend/src/
├── pages/                 # Route components
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── maps/             # Map-specific components
├── hooks/                 # Custom React hooks
├── services/              # API service layer
│   ├── api.ts            # Base API service
│   ├── auth.ts           # Authentication
│   ├── rides.ts          # Rides management
│   └── maps.ts           # Maps integration
├── integrations/          # External integrations
│   └── supabase/         # Supabase client & types
└── lib/                   # Utilities and helpers
```

### Camada de Serviços
Centraliza todas as chamadas de API e lógica de comunicação:

```typescript
// Exemplo de uso
import { ridesService } from '@/services/rides';

const createRide = async (rideData) => {
  const result = await ridesService.createRide(rideData);
  if (result.status === 'success') {
    // Handle success
  } else {
    // Handle error
  }
};
```

## Backend (Supabase)

### Responsabilidades
- **Autenticação** - JWT tokens via Supabase Auth
- **Base de Dados** - PostgreSQL com RLS
- **Lógica de Negócio** - Edge Functions
- **APIs Externas** - Proxy para Google Maps
- **Real-time** - WebSocket connections
- **File Storage** - Supabase Storage

### Edge Functions
Serverless functions para lógica de backend:

```
backend/supabase/functions/
├── get-maps-key/          # Google Maps API key proxy
├── ride-queue-manager/    # Driver queue management
└── google-maps-proxy/     # Google Maps API proxy
```

### Database Schema
Tabelas principais:
- `profiles` - Dados dos usuários
- `drivers` - Informações específicas de motoristas
- `rides` - Corridas e seu status
- `driver_locations` - Localização em tempo real
- `ride_notifications` - Fila de notificações
- `system_settings` - Configurações do sistema

### Row Level Security (RLS)
Políticas de segurança aplicadas:
- Usuários só veem seus próprios dados
- Motoristas só recebem corridas relevantes
- Admins têm acesso controlado
- Logs de auditoria protegidos

## Shared (Código Compartilhado)

### Types
Tipos TypeScript compartilhados entre frontend e backend:
```typescript
export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: 'success' | 'error';
}
```

### Utils
Funções utilitárias comuns:
```typescript
export function calculateDistance(point1, point2): number;
export function formatCurrency(amount): string;
export function validateCoordinates(lat, lng): boolean;
```

## Fluxo de Dados

### Solicitação de Corrida
1. **Frontend** - Usuário preenche origem/destino
2. **Maps Service** - Calcula rota e preço
3. **Rides Service** - Cria corrida no banco
4. **Edge Function** - Aciona fila de motoristas
5. **Real-time** - Notifica motoristas disponíveis
6. **WebSocket** - Atualiza UI em tempo real

### Autenticação
1. **Frontend** - Login form submission
2. **Auth Service** - Supabase Auth API
3. **JWT Token** - Stored in localStorage
4. **Protected Routes** - Authentication guards
5. **RLS Policies** - Database-level security

## Integração com Google Maps

### Arquitetura Segura
- **API Key Protection** - Keys servidas via Edge Function
- **Domain Restrictions** - Configurado no Google Cloud
- **Rate Limiting** - Supabase throttling
- **Error Handling** - Graceful degradation

### Funcionalidades
- **Geolocation** - GPS do usuário
- **Autocomplete** - Busca de endereços
- **Route Calculation** - Distância e tempo
- **Real-time Tracking** - Posição do motorista
- **Map Display** - Interface interativa

## Monitoramento e Logs

### Frontend
- **Error Boundaries** - Captura erros React
- **Analytics** - Eventos de usuário
- **Performance** - Core Web Vitals

### Backend
- **Edge Function Logs** - Supabase Dashboard
- **Database Logs** - Query performance
- **Auth Logs** - Login attempts
- **Audit Logs** - Ações críticas

## Escalabilidade

### Horizontal Scaling
- **Frontend** - CDN + Multiple regions
- **Backend** - Supabase auto-scaling
- **Database** - Read replicas
- **Edge Functions** - Global distribution

### Performance Optimizations
- **Code Splitting** - Lazy loading
- **Image Optimization** - WebP format
- **Database Indexes** - Query optimization
- **Caching** - TanStack Query + CDN

## Segurança

### Frontend Security
- **Input Validation** - Zod schemas
- **XSS Protection** - Sanitized outputs
- **CSRF Protection** - SameSite cookies
- **Content Security Policy** - Restricted scripts

### Backend Security
- **RLS Policies** - Row-level access control
- **SQL Injection** - Parameterized queries
- **Rate Limiting** - API throttling
- **Secrets Management** - Environment variables

## Desenvolvimento Local

### Prerequisites
- Node.js 18+
- Supabase CLI
- Google Cloud account (Maps API)

### Setup
```bash
npm run install:all      # Install all dependencies
npm run dev             # Start frontend + backend
```

### Environment Variables
```bash
# Frontend
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Backend (Supabase Secrets)
GOOGLE_MAPS_FRONTEND_API_KEY=
GOOGLE_MAPS_BACKEND_API_KEY=
```

## Deploy Strategy

### Frontend
- **Build** - Vite production build
- **CDN** - Static asset distribution
- **Routing** - SPA fallback rules

### Backend
- **Functions** - Auto-deploy via Supabase
- **Database** - Migration-based updates
- **Secrets** - Environment-specific configs

Esta arquitetura garante uma base sólida para crescimento e manutenção da plataforma.