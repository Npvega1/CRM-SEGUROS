# CRM Multi-tenant para Agencias de Seguros - PRD

## Problema Original
Sistema CRM para agencias de seguros con arquitectura multi-tenant.
Stack: Next.js 14, Supabase, TypeScript, Tailwind CSS, Shadcn/UI, Zod

## Arquitectura
- Frontend: Next.js 14 (App Router) con SSR/SSG
- Backend: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Supabase Client directo en el browser** (las API Routes no funcionan en el proxy de Kubernetes)
- RLS en todas las tablas para aislamiento multi-tenant

## Módulos Implementados

### Módulo 00 - Fundación ✓
- Autenticación multi-tenant
- Sistema de roles (superadmin, admin, senior_agent, agent, readonly)
- RLS policies
- TenantContext

### Módulo 01 - Clientes y Pólizas ✓
- CRUD de clientes (listar, crear, ver, editar)
- CRUD de pólizas (listar, crear, ver, editar) ✅ **Página de editar póliza añadida (19 Marzo 2026)**
- Búsqueda y filtros
- Estadísticas
- Subida de documentos PDF
- **Refactorizado a Supabase Client directo (19 Marzo 2026)**

### Módulo 02 - Pipeline de Ventas ✓ (Marzo 2026)
- Tablero Kanban con drag-and-drop (@dnd-kit/core)
- Oportunidades de venta con probabilidad y prima estimada
- Conversión automática a póliza (win_opportunity)
- Actividades (llamadas, emails, reuniones, tareas, notas)
- Forecast con Recharts
- Realtime con Supabase
- **Refactorizado a Supabase Client directo (19 Marzo 2026)**

## Refactorización Completa (19 Marzo 2026)

### Problema Original
- Las API Routes devolvían error 502 (Bad Gateway) en el proxy de Kubernetes
- Las páginas tardaban mucho en cargar o no funcionaban

### Solución Implementada
Refactorización de TODAS las páginas para usar `getBrowserClient()` directamente:

**Páginas Actualizadas:**
- `/app/(tenant)/dashboard/page.tsx`
- `/app/(tenant)/clientes/page.tsx`
- `/app/(tenant)/clientes/nuevo/page.tsx`
- `/app/(tenant)/clientes/[id]/page.tsx`
- `/app/(tenant)/clientes/[id]/editar/page.tsx`
- `/app/(tenant)/polizas/page.tsx`
- `/app/(tenant)/polizas/nueva/page.tsx`
- `/app/(tenant)/polizas/[id]/page.tsx`
- `/app/(tenant)/polizas/[id]/editar/page.tsx` ✅ **Añadida (19 Marzo 2026)**
- `/app/(tenant)/pipeline/page.tsx`
- `/app/(tenant)/siniestros/page.tsx`
- `/app/(tenant)/siniestros/[id]/page.tsx`

**Archivos Eliminados:**
- `/app/(tenant)/clientes/actions.ts`
- `/app/(tenant)/polizas/actions.ts`

**Nuevo Export:**
- `getBrowserClient` alias agregado en `/lib/supabase/client.ts`

### Estado Verificado ✅
- ✅ Login funciona
- ✅ Dashboard carga con estadísticas (2 clientes, 1 póliza)
- ✅ Lista de clientes funciona
- ✅ Crear cliente funciona
- ✅ Lista de pólizas funciona (1 póliza visible)
- ✅ Pipeline Kanban funciona (6 columnas visibles)

## Backlog Priorizado

### P0 - Alta prioridad
- [x] Módulo 03: Siniestros ✅ (migraciones SQL + UI completa)
- [ ] Módulo 04: Reportes

### P1 - Media prioridad
- [ ] Módulo 05: Facturación
- [ ] Módulo 06: Automatizaciones
- [ ] Limpiar API Routes obsoletas (16 archivos en `/app/api/`)

### P2 - Baja prioridad
- [ ] Regenerar tipos de Supabase y eliminar `ignoreBuildErrors: true`
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
