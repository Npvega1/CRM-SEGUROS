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
- API Route con service_role para registro (bypasa RLS)

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
- [x] Autenticación con Supabase Auth
- [x] Row Level Security en todas las tablas
- [x] JWT con claims personalizados (tenant_id, role, agent_id)
- [x] Middleware de protección de rutas

### Multi-tenancy
- [x] Aislamiento completo de datos entre tenants
- [x] Tabla de tenants con slug único
- [ ] Límites por plan (pendiente Módulo 10)

### Módulos
- [x] M00: Fundación ✅ COMPLETADO
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

## Lo Implementado (Fecha: 2026-01-17)

### Fase 0 - Fundación ✅ COMPLETADA Y PROBADA

1. **Migraciones SQL ejecutadas en Supabase**
   - Tablas: tenants, users, user_roles, invitations, audit_logs
   - Enum: user_role
   - Funciones: get_tenant_id(), get_user_role(), is_superadmin()
   - Triggers: updated_at automático
   - Políticas RLS completas

2. **Clientes Supabase** (`/lib/supabase/`)
   - client.ts: Cliente browser
   - server.ts: Cliente server components
   - admin.ts: Cliente service role
   - database.types.ts: Tipos TypeScript

3. **API de Registro** (`/registro-api/route.ts`)
   - Usa service_role para bypasear RLS
   - Crea usuario, tenant y perfil en una transacción
   - Configura JWT claims automáticamente

4. **Middleware** (`/middleware.ts`)
   - Protección de rutas autenticadas
   - Verificación de tenant_id en JWT
   - Rutas públicas: /login, /registro

5. **Tipos Globales** (`/lib/types/index.ts`)
   - Schemas Zod para todas las entidades
   - Tipos TypeScript inferidos
   - TenantContext interface

6. **TenantContext Provider** (`/lib/context/TenantContext.tsx`)
   - React Context con información del tenant
   - Hook useTenant()
   - Hook useHasRole()

7. **Páginas funcionales y probadas**
   - ✅ Login (/login): Formulario con validación Zod
   - ✅ Registro (/registro): Crear agencia + admin con API
   - ✅ Dashboard (/dashboard): Vista inicial con stats
   - ✅ Sin organización (/sin-organizacion)

8. **Componentes UI**
   - Button, Card, Input, Label, Spinner

### Flujo probado exitosamente:
1. Usuario se registra → crea agencia + usuario admin
2. Usuario hace login → va al dashboard
3. Dashboard muestra nombre y rol del usuario

---

## Configuración de Supabase

### Email Settings
- Confirm email: **DESACTIVADO** (para desarrollo)

### Tablas creadas
- tenants
- users
- user_roles
- invitations
- audit_logs

---

## Backlog Priorizado

### P0 - Crítico (Próximo)
- [ ] Módulo 01 - Clientes y Pólizas
  - CRUD de clientes
  - CRUD de pólizas
  - Relación cliente-póliza

### P1 - Alta Prioridad
- [ ] Módulo 02: Pipeline de Ventas
- [ ] Módulo 03: Siniestros

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

1. Comenzar Módulo 01: Clientes y Pólizas
2. Crear tablas: clients, policies
3. CRUD completo con validaciones Zod
4. Listados con filtros y paginación
