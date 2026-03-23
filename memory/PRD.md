# CRM Multi-Tenant para Agencias de Seguros - PRD

## Información del Proyecto
- **Stack**: Next.js 14, Supabase, TypeScript, Tailwind CSS, Shadcn/UI
- **Repositorio**: https://github.com/Npvega1/CRM-SEGUROS
- **Rama**: modulo09 → modulo11 (nuevo)
- **Última actualización**: Enero 2026

## User Personas
1. **Super Administrador**: Gestiona toda la plataforma, ve métricas globales, configura prompts de IA
2. **Admin de Agencia**: Gestiona su tenant, usuarios, clientes y pólizas
3. **Agente Senior**: Acceso completo a clientes y pólizas de su agencia
4. **Agente**: Acceso limitado a sus propios clientes
5. **Cliente Portal**: Accede a sus pólizas vía Magic Link

## Módulos Implementados

### ✅ Módulo 00 - Fundación
- Autenticación con Supabase Auth
- Multi-tenancy con RLS
- Sistema de roles

### ✅ Módulo 01 - Clientes y Pólizas
- CRUD de clientes
- Gestión de pólizas
- Documentos adjuntos

### ✅ Módulo 02 - Pipeline de Ventas
- Oportunidades
- Estados y etapas
- Actividades

### ✅ Módulo 03 - Siniestros
- Registro de siniestros
- Seguimiento de estados
- Documentación

### ✅ Módulo 04 - Reportes y Analytics
- Dashboards con Recharts
- Funciones SQL SECURITY DEFINER
- Exportación a Excel

### ✅ Módulo 05 - Facturación y Comisiones
- Cuotas de pólizas
- Registro de pagos
- Comisiones de agentes

### ✅ Módulo 06 - Automatizaciones
- Workflows configurables
- Triggers automáticos
- Email MOCK

### ✅ Módulo 07 - Portal del Cliente
- Autenticación Magic Link (MOCK)
- Ver pólizas y pagos
- Chat con agentes

### ✅ Módulo 08 - Configuración Visual
- Colores personalizables
- Logo de agencia
- Nombre del negocio

### ✅ Módulo 09 - Comparativos con IA
- Análisis de cotizaciones PDF
- Integración Claude API
- Recomendaciones automatizadas

### ✅ Módulo 11 - Super Admin (NUEVO - Enero 2026)
**Implementado en esta sesión:**

#### Componentes creados:
- `app/(superadmin)/admin/layout.tsx` - Layout oscuro/rojo distintivo
- `app/(superadmin)/admin/tenants/page.tsx` - Gestión de tenants
- `app/(superadmin)/admin/prompts/page.tsx` - Gestión de prompts IA
- `app/(superadmin)/admin/analytics/page.tsx` - Analytics de plataforma
- `app/(superadmin)/admin/security/page.tsx` - Dashboard de seguridad
- `components/modules/superadmin/TenantDetailDrawer.tsx`
- `components/modules/superadmin/CreateTenantModal.tsx`
- `components/modules/superadmin/PromptEditor.tsx`

#### Migración SQL:
- `supabase/migrations/00011_superadmin.sql`
  - Tabla `ai_prompts` - Prompts configurables
  - Tabla `ai_prompt_versions` - Historial de versiones
  - Tabla `platform_analytics` - Métricas de plataforma
  - Funciones: `get_tenant_stats()`, `calculate_platform_analytics()`

#### Funcionalidades:
- Lista global de tenants con métricas (agentes, clientes, pólizas)
- Crear tenant manualmente
- Suspender/reactivar tenants
- CRUD de prompts de IA con versionamiento
- Probar prompts con Claude (MOCK)
- Publicar/deprecar prompts
- Analytics: gráficas de crecimiento, distribución por plan
- Oportunidades de upsell (tenants cerca del límite)
- Audit logs con filtros
- Estado de RLS por tabla

## Backlog (P0/P1/P2)

### P0 - Crítico
- [ ] Ejecutar migración SQL en Supabase
- [ ] Crear usuario superadmin con role en app_metadata
- [ ] Configurar credenciales reales de Supabase

### P1 - Importante
- [ ] Integrar Claude API real para test de prompts
- [ ] Implementar email real (Resend/SendGrid)
- [ ] Magic Link OTP real para portal cliente
- [ ] Trigger automático de cuotas de facturación
- [ ] Permisos granulares por rol

### P2 - Mejoras
- [ ] Módulo 12 - Agentes Aliados
- [ ] Aplicar colores dinámicos a toda la interfaz
- [ ] Contador de pólizas correcto en lista de clientes
- [ ] Flujo completo de emisión con verificación
- [ ] Proceso de aplicación de pago con código único
- [ ] Definir módulo de mensajes y asignación de agentes

## Decisiones Técnicas

### RLS y Autenticación
- tenant_id en JWT está en `app_metadata`
- RLS usa: `(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`
- Super Admin verifica `role='superadmin'` en middleware

### Cliente Supabase
- `getBrowserClient()` - Cliente con tipos para tablas existentes
- `getUntypedClient()` - Cliente sin tipos para tablas nuevas (M11)
- NO usar Server Actions ni API Routes

### Módulo Super Admin
- Rutas en `/admin/*` protegidas por middleware
- Sin RLS en tablas: ai_prompts, ai_prompt_versions, platform_analytics
- Acceso vía `service_role` en Edge Functions

## Errores Conocidos
- Triggers PostgreSQL: usar `auth.uid()` NO `auth.user_id()`
- Storage privado: usar `createSignedUrl()`, no `.download()`
- Tipos Supabase: actualizar manualmente al agregar columnas

## Próximos Pasos
1. Desplegar en Vercel con credenciales reales
2. Ejecutar migración 00011_superadmin.sql
3. Crear usuario superadmin en Supabase Auth
4. Probar flujo completo de Super Admin
5. Integrar Claude API real con Emergent LLM Key
