# PRD - CRM Multi-tenant para Agencias de Seguros

## Problema Original

Construir un CRM multi-tenant para agencias de seguros con Next.js 14, Supabase, TypeScript estricto, Tailwind CSS, Shadcn/UI y Zod.

---

## Arquitectura

### Stack Tecnológico
- **Frontend**: Next.js 14 (App Router)
- **Backend/Auth/DB**: Supabase (PostgreSQL)
- **Estilos**: Tailwind CSS + Shadcn/UI
- **Validaciones**: Zod + React Hook Form
- **Lenguaje**: TypeScript estricto

### Decisiones Técnicas
- Multi-tenancy basado en `tenant_id` en JWT claims
- RLS (Row Level Security) para aislamiento de datos
- Sistema de roles jerárquico (superadmin > admin > senior_agent > agent > readonly)

---

## User Personas

1. **Administrador de Agencia (admin)**
   - Gestiona usuarios, configuración y reportes de su agencia
   
2. **Agente de Seguros (agent/senior_agent)**
   - Opera el día a día: clientes, pólizas, siniestros
   
3. **Super Admin (superadmin)**
   - Gestiona todas las agencias y planes

---

## Core Requirements (Estático)

### Seguridad
- [ ] Autenticación con Supabase Auth
- [x] Row Level Security en todas las tablas
- [x] JWT con claims personalizados (tenant_id, role, agent_id)
- [x] Middleware de protección de rutas

### Multi-tenancy
- [x] Aislamiento completo de datos entre tenants
- [x] Tabla de tenants con slug único
- [ ] Límites por plan (pendiente Módulo 10)

### Módulos
- [x] M00: Fundación
- [ ] M01: Clientes y Pólizas
- [ ] M02: Pipeline de Ventas
- [ ] M03: Siniestros
- [ ] M04: Reportes
- [ ] M05: Facturación
- [ ] M06: Automatizaciones
- [ ] M07: Portal del Cliente
- [ ] M08: Configuración Visual
- [ ] M09: Comparativos con IA
- [ ] M10: Planes y Pagos
- [ ] M11: Super Admin

---

## Lo Implementado (Fecha: 2026-01-16)

### Fase 0 - Fundación ✅

1. **Migraciones SQL** (`/supabase/migrations/00000_foundation.sql`)
   - Tablas: tenants, users, user_roles, invitations, audit_logs
   - Enum: user_role
   - Funciones: auth.tenant_id(), auth.user_role(), auth.is_superadmin()
   - Triggers: updated_at automático
   - Políticas RLS completas

2. **Clientes Supabase** (`/lib/supabase/`)
   - client.ts: Cliente browser
   - server.ts: Cliente server components
   - admin.ts: Cliente service role
   - database.types.ts: Tipos TypeScript

3. **Middleware** (`/middleware.ts`)
   - Protección de rutas autenticadas
   - Verificación de tenant_id en JWT
   - Rutas públicas: /login, /registro
   - Rutas superadmin: /superadmin/*
   - Stub para verificación de planes

4. **Tipos Globales** (`/lib/types/index.ts`)
   - Schemas Zod para todas las entidades
   - Tipos TypeScript inferidos
   - TenantContext interface
   - Result<T, E> pattern para manejo de errores
   - Funciones helper: ok(), err(), hasMinimumRole()

5. **TenantContext Provider** (`/lib/context/TenantContext.tsx`)
   - React Context con información del tenant
   - Hook useTenant()
   - Hook useHasRole()
   - Hook useIsAuthenticated()
   - Auto-refresh en cambios de auth

6. **Páginas de Auth**
   - Login (/login): Formulario con validación Zod
   - Registro (/registro): Crear agencia + admin
   - Sin organización (/sin-organizacion): Estado de error

7. **Dashboard** (`/(tenant)/dashboard`)
   - Vista inicial con stats placeholder
   - Acciones rápidas
   - Setup progress para nuevos tenants

8. **Componentes UI**
   - Button, Card, Input, Label, Spinner

---

## Backlog Priorizado

### P0 - Crítico (Próximo)
- [ ] Ejecutar migraciones SQL en Supabase
- [ ] Probar flujo completo de registro/login
- [ ] Implementar Módulo 01: Clientes y Pólizas

### P1 - Alta Prioridad
- [ ] Módulo 02: Pipeline de Ventas
- [ ] Módulo 03: Siniestros
- [ ] Edge Function auth-hook para JWT claims

### P2 - Media Prioridad
- [ ] Módulo 04: Reportes
- [ ] Módulo 05: Facturación
- [ ] Módulo 06: Automatizaciones

### P3 - Baja Prioridad
- [ ] Módulo 07: Portal del Cliente
- [ ] Módulo 08: Configuración Visual
- [ ] Módulo 09: Comparativos con IA
- [ ] Módulo 10: Planes y Pagos
- [ ] Módulo 11: Super Admin

---

## Próximas Tareas

1. **USUARIO DEBE HACER**: Ejecutar `/supabase/migrations/00000_foundation.sql` en Supabase SQL Editor
2. Probar registro de agencia y login
3. Comenzar Módulo 01: Clientes y Pólizas
