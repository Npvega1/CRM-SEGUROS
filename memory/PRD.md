# CRM Multi-tenant para Agencias de Seguros - PRD

## Información del Proyecto
- **Stack**: Next.js 14, Supabase, TypeScript, Tailwind CSS, Shadcn/UI
- **Repositorio**: https://github.com/Npvega1/CRM-SEGUROS
- **Rama actual**: modulo06 (con M07 implementado)

## Arquitectura
- Multi-tenant con RLS en Supabase
- tenant_id extraído del JWT: `(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`
- Sin Server Actions, usa Supabase Client directo (getBrowserClient())
- Triggers PostgreSQL usan `auth.uid()` NO `auth.user_id()`

## Módulos Implementados

### [✓] Módulo 00 - Fundación
- Configuración base del proyecto
- Autenticación Supabase
- Layout del tenant

### [✓] Módulo 01 - Clientes y Pólizas
- CRUD de clientes
- Gestión de pólizas
- Documentos de pólizas

### [✓] Módulo 02 - Pipeline de Ventas
- Etapas de pipeline
- Gestión de oportunidades
- Actividades

### [✓] Módulo 03 - Siniestros
- Gestión de claims
- Historial de estados
- Documentos de siniestros

### [✓] Módulo 04 - Reportes y Analytics
- Dashboard ejecutivo
- Reportes con funciones SQL SECURITY DEFINER

### [✓] Módulo 05 - Facturación y Comisiones
- Invoices y cuotas
- Comisiones por póliza
- Tasas por aseguradora

### [✓] Módulo 06 - Automatizaciones y Workflows
- Sistema de automatizaciones
- Cola de procesamiento
- Notificaciones in-app
- Email MOCK (sin servicio real)

### [✓] Módulo 07 - Portal del Cliente (NUEVO - Implementado Enero 2026)
**Archivos creados:**
- `supabase/migrations/00007_portal.sql` - Migración con tablas y funciones
- `src/lib/validations/portal.ts` - Schemas Zod y tipos
- `src/lib/context/PortalContext.tsx` - Contexto del portal
- `src/app/(portal)/[tenantSlug]/layout.tsx` - Layout white-label
- `src/app/(portal)/[tenantSlug]/login/page.tsx` - Magic Link (MOCK)
- `src/app/(portal)/[tenantSlug]/dashboard/page.tsx` - Dashboard cliente
- `src/app/(portal)/[tenantSlug]/policies/page.tsx` - Lista pólizas
- `src/app/(portal)/[tenantSlug]/claims/page.tsx` - Lista siniestros
- `src/app/(portal)/[tenantSlug]/claims/new/page.tsx` - Reportar siniestro
- `src/app/(portal)/[tenantSlug]/account/page.tsx` - Estado de cuenta
- `src/app/(portal)/[tenantSlug]/chat/page.tsx` - Chat con agente
- `src/app/(portal)/[tenantSlug]/manifest.webmanifest/route.ts` - PWA básico

**Tablas SQL creadas:**
- `tenant_settings` - Configuración visual del tenant (placeholder M08)
- `portal_sessions` - Sesiones de clientes
- `messages` - Chat cliente-agente
- `client_requests` - Solicitudes del cliente

**Funciones SQL creadas:**
- `get_portal_client_by_email()` - Verificar cliente por email
- `get_portal_summary()` - Resumen del portal
- `register_portal_session()` - Registrar sesión
- `update_portal_session_activity()` - Actualizar actividad
- `is_agent_online()` - Verificar agente en línea

**Notas:**
- Magic Link OTP está como MOCK (sin envío real de email)
- PWA solo incluye manifest básico (sin service worker completo)
- Chat usa Supabase Realtime
- White-label inyecta CSS variables dinámicamente

## Módulos Pendientes
- [ ] Módulo 08 - Configuración Visual
- [ ] Módulo 09 - Comparativos con IA
- [ ] Módulo 10 - Planes y Pagos
- [ ] Módulo 11 - Super Admin

## Backlog de Mejoras (P2/P3)
- Facturación: trigger automático de cuotas no funciona
- Facturación: fecha de vencimiento de cuotas incorrecta
- Facturación: agregar 25 días de gracia
- Pólizas: agregar más campos de información
- Clientes: contador de pólizas muestra 0
- Integrar servicio de email real (Resend o SendGrid)
- Portal: Implementar Magic Link OTP real
- Portal: Service worker completo para PWA

## Configuración Requerida
Variables de entorno necesarias en `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Última Actualización
- Fecha: Enero 2026
- Sesión: Implementación Módulo 07 - Portal del Cliente
