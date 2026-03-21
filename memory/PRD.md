# CRM Multi-tenant para Agencias de Seguros - PRD

## Problema Original
Desarrollar un CRM completo multi-tenant para agencias de seguros.

## Stack Tecnológico
- **Framework:** Next.js 14 (App Router)
- **Base de Datos:** Supabase (PostgreSQL con RLS)
- **UI:** Tailwind CSS + Shadcn/UI
- **Validación:** Zod
- **Despliegue:** Vercel

## Estado Actual del Proyecto

### Ramas en GitHub:
- `modulo07` - Respaldo funcional (Módulos 01-07 completos)
- `modulo08-settings` - **PRODUCCIÓN ACTUAL** - Con página de Configuración básica

### URL de Producción:
- crm-seguros-lovat.vercel.app

## Módulos Implementados

### Módulo 01-07 ✅ COMPLETOS
- Fundación multi-tenant
- Clientes y Pólizas
- Pipeline de Ventas (Kanban)
- Siniestros
- Reportes
- Facturación
- Automatizaciones
- Portal de Clientes

### Módulo 08 - Configuración Visual ⚠️ PARCIAL (21 Marzo 2025)

**Implementado:**
- ✅ Página SettingsPage con 3 pestañas (Cuenta, Visual, Equipo)
- ✅ Enlace "Configuración" en menú lateral
- ✅ Pestaña Cuenta muestra info del tenant

**Pendiente:**
- ❌ BrandingPanel completo (colores, fuentes, logo/favicon con preview)
- ❌ AgentsPanel completo (tabla de agentes, cambio de roles, activar/desactivar)
- ❌ AgentInviteModal (modal para invitar agentes por email)
- ❌ EmailConfigPanel (configuración de proveedor de email MOCK)
- ❌ Hook useTenantBranding (inyectar CSS dinámico)
- ❌ Validaciones con Zod
- ❌ Migración SQL para tenant_settings con RLS

## Módulos Pendientes

### Módulo 09 - Comparativos con IA (P1)
### Módulo 10 - Planes y Pagos (P1)
### Módulo 11 - Super Admin (P1)

## Backlog (P2)

- Integrar servicio de email real (Resend/SendGrid)
- Implementar Magic Link OTP real en el portal
- Corregir triggers de facturación automática
- Añadir contador de pólizas a la lista de clientes
- Limpiar console.log del código

## Notas Técnicas Importantes

### Problema de "Save to Github" de Emergent
Durante la sesión del 21 de Marzo, se detectó que "Save to Github" no sincroniza correctamente los archivos del frontend. La solución fue editar archivos directamente en GitHub.

### Límite de Vercel
Plan gratuito tiene límite de 100 deploys por día. Se alcanzó el 21 de Marzo.

### Estructura de archivos del Módulo 08:
```
frontend/src/app/(tenant)/settings/page.tsx - ✅ Creado
frontend/src/app/(tenant)/layout.tsx - ✅ Actualizado con enlace Configuración
```

## Funcionalidades MOCK
1. Envío de Emails - simulado en consola
2. Magic Link OTP - autenticación simulada en portal
