# CRM Multi-tenant para Agencias de Seguros - PRD

## Problema Original
Desarrollar un CRM completo multi-tenant para agencias de seguros que permita:
- Gestión de clientes, pólizas, siniestros
- Pipeline de ventas con Kanban
- Facturación y comisiones
- Automatizaciones y notificaciones
- Portal de clientes (self-service)
- Configuración visual y gestión de agentes

## Stack Tecnológico
- **Framework:** Next.js 14 (App Router)
- **Base de Datos:** Supabase (PostgreSQL con RLS)
- **UI:** Tailwind CSS + Shadcn/UI
- **Validación:** Zod
- **Despliegue:** Vercel

## Módulos Implementados

### Módulo 01 - Fundación ✅
- Estructura multi-tenant con RLS
- Autenticación con Supabase Auth
- Context de tenant

### Módulo 02 - Clientes y Pólizas ✅
- CRUD de clientes
- Gestión de pólizas
- Vista 360° del cliente
- Importación CSV

### Módulo 03 - Pipeline de Ventas ✅
- Tablero Kanban
- Oportunidades drag & drop
- Timeline de actividades
- Conversión a póliza

### Módulo 04 - Siniestros ✅
- Gestión de reclamaciones
- Stepper de estado
- Timeline con comentarios
- Documentos adjuntos

### Módulo 05 - Reportes ✅
- Dashboard ejecutivo
- Performance de agentes
- Distribución de cartera
- Análisis de siniestros
- Informe de renovaciones
- Reporte de comisiones

### Módulo 06 - Facturación ✅
- Generación de cuotas
- Control de pagos
- Tasas de comisión
- Estado de cuenta

### Módulo 07 - Automatizaciones ✅
- Builder de reglas
- Plantillas de email
- Notificaciones in-app
- Logs de ejecución

### Módulo 07 - Portal de Clientes ✅
- Login con Magic Link (MOCK)
- Dashboard del cliente
- Consulta de pólizas
- Seguimiento de siniestros
- Chat con agente
- Solicitudes

### Módulo 08 - Configuración Visual ✅ (Implementado: Diciembre 2024)
**Componentes:**
- `SettingsPage` - Página principal con 4 pestañas
- `BrandingPanel` - Personalización visual (colores, fuentes, logo, favicon)
- `AgentsPanel` - Gestión de agentes del tenant
- `AgentInviteModal` - Modal para invitar nuevos agentes
- `EmailConfigPanel` - Configuración de proveedor de email (MOCK)

**Hook:**
- `useTenantBranding` - Inyecta CSS dinámico según configuración

**Validaciones Zod:**
- `BrandingInputSchema` - Colores hex, fuentes permitidas
- `InviteAgentInputSchema` - Email y rol
- `EmailConfigInputSchema` - Proveedor y credenciales

**Navegación:**
- Enlace "Configuración" añadido al sidebar principal

**Migración SQL:**
- `00008_tenant_settings.sql` - Tabla tenant_settings + invitations + RLS

## Módulos Pendientes

### Módulo 09 - Comparativos con IA (P1)
- Integración con LLM
- Comparación de pólizas
- Recomendaciones

### Módulo 10 - Planes y Pagos (P1)
- Modelo de suscripción
- Integración Stripe
- Límites por plan

### Módulo 11 - Super Admin (P1)
- Panel de administración global
- Gestión de tenants
- Métricas de uso

## Estructura de Archivos del Módulo 08

```
frontend/
├── src/
│   ├── app/(tenant)/
│   │   ├── layout.tsx          # ✅ Actualizado con link "Configuración"
│   │   └── settings/
│   │       └── page.tsx        # ✅ Página principal
│   ├── components/modules/settings/
│   │   ├── index.ts            # ✅ Exports
│   │   ├── BrandingPanel.tsx   # ✅ Panel de branding
│   │   ├── AgentsPanel.tsx     # ✅ Panel de agentes
│   │   ├── AgentInviteModal.tsx # ✅ Modal de invitación
│   │   └── EmailConfigPanel.tsx # ✅ Config de email
│   ├── lib/
│   │   ├── hooks/
│   │   │   └── useTenantBranding.ts # ✅ Hook de branding
│   │   └── validations/
│   │       └── settings.ts     # ✅ Schemas Zod
└── supabase/migrations/
    └── 00008_tenant_settings.sql # ✅ Migración SQL
```

## Funcionalidades MOCK

1. **Envío de Emails:** Los emails se simulan y registran en consola
2. **Magic Link OTP:** El portal de clientes usa autenticación simulada
3. **Integración Email:** La configuración de Resend/SendGrid es MOCK

## Backlog (P2)

- Corregir triggers de facturación automática
- Corregir cálculo de fechas de vencimiento de cuotas
- Añadir contador de pólizas a la lista de clientes
- Integrar servicio de email real (Resend/SendGrid)
- Implementar Magic Link OTP real en el portal
- Limpiar console.log del Módulo 07
