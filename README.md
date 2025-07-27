# Plataforma MotoTaxi

Sistema de corridas de mototáxi com separação clara entre frontend e backend.

## Project Info

**URL**: https://lovable.dev/projects/1026a553-0d8c-4206-a1ed-85532e7ba64d

## Estrutura do Projeto

```
mototaxi-platform/
├── frontend/              # Aplicação React
│   ├── src/
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── components/    # Componentes React
│   │   ├── hooks/         # Hooks customizados
│   │   ├── services/      # Camada de serviços API
│   │   └── integrations/  # Integrações (Supabase)
│   └── public/            # Assets estáticos
│
├── backend/               # Backend Supabase
│   └── supabase/
│       ├── functions/     # Edge Functions
│       ├── migrations/    # Migrações do banco
│       └── config.toml    # Configuração Supabase
│
├── shared/                # Código compartilhado
│   ├── types/             # Tipos TypeScript
│   └── utils/             # Utilitários comuns
│
└── docs/                  # Documentação
```

## Tecnologias

### Frontend
- **React 18** - Framework de interface
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS
- **shadcn/ui** - Componentes UI
- **React Router** - Roteamento
- **TanStack Query** - Gerenciamento de estado servidor
- **Google Maps API** - Integração de mapas

### Backend
- **Supabase** - Backend as a Service
- **PostgreSQL** - Banco de dados
- **Row Level Security** - Segurança de dados
- **Edge Functions** - Serverless functions
- **Realtime** - Atualizações em tempo real

## Instalação e Execução

### Configuração Inicial
```bash
# Instalar dependências no frontend
cd frontend && npm install

# Instalar dependências no backend
cd backend && npm install
```

### Desenvolvimento
```bash
# Executar frontend
cd frontend && npm run dev          # localhost:8080

# Executar backend
cd backend && npm run start         # Supabase local
```

### Build e Deploy
```bash
# Build do frontend
cd frontend && npm run build

# Deploy das Edge Functions
cd backend && npm run functions:deploy
```

## How to Edit This Code

**Use Lovable** (Recommended)
Simply visit the [Lovable Project](https://lovable.dev/projects/1026a553-0d8c-4206-a1ed-85532e7ba64d) and start prompting.

**Use your preferred IDE**
Clone this repo and push changes. The only requirement is having Node.js & npm installed.

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
cd frontend && npm install  # Install frontend dependencies
npm run dev                 # Start development server
```

## Deploy

Simply open [Lovable](https://lovable.dev/projects/1026a553-0d8c-4206-a1ed-85532e7ba64d) and click on Share → Publish.

For more details, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
