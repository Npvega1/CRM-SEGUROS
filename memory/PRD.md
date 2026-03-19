# CRM Multi-tenant para Agencias de Seguros - PRD

## Problema Original
Sistema CRM para agencias de seguros con arquitectura multi-tenant.
Stack: Next.js 14, Supabase, TypeScript, Tailwind CSS, Shadcn/UI, Zod

## Arquitectura
- Frontend: Next.js 14 (App Router) con SSR/SSG
- Backend: Supabase (PostgreSQL + Auth + Storage + Realtime)
- API Routes en lugar de Server Actions (por compatibilidad con Kubernetes/Emergent)
- RLS en todas las tablas para aislamiento multi-tenant

## Módulos Implementados

### Módulo 00 - Fundación ✓
- Autenticación multi-tenant
- Sistema de roles (superadmin, admin, senior_agent, agent, readonly)
- RLS policies
- TenantContext

### Módulo 01 - Clientes y Pólizas ✓
- CRUD de clientes
- CRUD de pólizas
- Búsqueda y filtros
- Estadísticas

### Módulo 02 - Pipeline de Ventas ✓ (Marzo 2026)
- Tablero Kanban con drag-and-drop (@dnd-kit/core)
- Oportunidades de venta con probabilidad y prima estimada
- Conversión automática a póliza (win_opportunity)
- Actividades (llamadas, emails, reuniones, tareas, notas)
- Forecast con Recharts
- Realtime con Supabase

## Backlog Priorizado

### P0 - Alta prioridad
- [ ] Módulo 03: Siniestros
- [ ] Módulo 04: Reportes

### P1 - Media prioridad
- [ ] Módulo 05: Facturación
- [ ] Módulo 06: Automatizaciones

### P2 - Baja prioridad
- [ ] Módulo 07: Portal del Cliente
- [ ] Módulo 08: Configuración Visual
- [ ] Módulo 09: Comparativos con IA
- [ ] Módulo 10: Planes y Pagos
- [ ] Módulo 11: Super Admin

## Decisiones Técnicas Importantes
1. API Routes en lugar de Server Actions (Kubernetes compatibility)
2. tenant_id en JWT dentro de app_metadata
3. RLS usa: (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
4. Hot reload con doble wildcard en allowedOrigins de next.config.mjs
