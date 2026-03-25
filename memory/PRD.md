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

### ✅ Módulo 11 - Super Admin (Enero 2026)
**Implementado:**

#### Componentes creados:
- `app/(superadmin)/admin/layout.tsx` - Layout oscuro/rojo distintivo
- `app/(superadmin)/admin/tenants/page.tsx` - Gestión de tenants
- `app/(superadmin)/admin/prompts/page.tsx` - Gestión de prompts IA
- `app/(superadmin)/admin/analytics/page.tsx` - Analytics de plataforma
- `app/(superadmin)/admin/security/page.tsx` - Dashboard de seguridad
- `app/(superadmin)/admin/catalogos/page.tsx` - Dashboard de catálogos
- `app/(superadmin)/admin/catalogos/companias/page.tsx` - CRUD compañías de seguros
- `app/(superadmin)/admin/catalogos/ramos/page.tsx` - CRUD ramos con asignación a compañías
- `app/(superadmin)/admin/catalogos/grupos/page.tsx` - CRUD grupos por ramo
- `components/modules/superadmin/TenantDetailDrawer.tsx`
- `components/modules/superadmin/CreateTenantModal.tsx`
- `components/modules/superadmin/PromptEditor.tsx`

#### Migraciones SQL:
- `00011_superadmin.sql` - Tablas ai_prompts, ai_prompt_versions, platform_analytics
- `00012_insurance_catalogs.sql` - Catálogos de compañías, ramos, grupos, relaciones

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

## Catálogos de Seguros (Fase 1-4)

### ✅ Fase 1 - Catálogos Globales (Completada)
- Tablas: `insurance_companies`, `insurance_lines` (Grupos), `insurance_groups` (Ramos)
- Migración: `00012_insurance_catalogs.sql`
- UI en Super Admin: `/admin/catalogos/*` para CRUD de catálogos

### ✅ Fase 2 - Configuración de Compañías por Tenant (Completada - Marzo 2026)
- Nueva pestaña "Compañías" en Configuración del Tenant (`/settings`)
- Switch para activar/desactivar compañías de seguros por tenant
- Campo para código de agente por compañía
- Tabla: `tenant_companies` con RLS

### ✅ Fase 3 - Formulario de Nueva Póliza con Selección en Cascada (Completada - Marzo 2026)
- Selección en cascada: Compañía → Grupo → Ramo
- Solo muestra compañías activas del tenant (desde `tenant_companies`)
- Carga dinámica de grupos según compañía (desde `company_lines`)
- Carga dinámica de ramos según grupo (desde `insurance_groups`)
- Migración: `00013_policies_catalog_relations.sql` (nuevas columnas en policies)
- Archivo modificado: `components/modules/policies/PolicyForm.tsx`

### ✅ Fase 4 - Filtrar Comparativos IA por Ramo (Completada - Marzo 2026)
- `has_ai_prompt` movido al nivel de Ramo (insurance_groups) para control granular
- El wizard de nuevo comparativo muestra solo Ramos con `has_ai_prompt = true`
- En Super Admin → Catálogos → Ramos: toggle de IA por cada ramo
- Migración: `00014_ramos_ai_prompt.sql`
- Archivos modificados: 
  - `components/modules/ai-compare/NewComparisonWizard.tsx`
  - `app/(superadmin)/admin/catalogos/grupos/page.tsx`

## Backlog (P0/P1/P2)

### P0 - Crítico
- [x] ~~Ejecutar migración SQL en Supabase~~ (migración 00012 creada)
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

## Integración IA - Comparativos y Cotizaciones (Marzo 2026)

### ✅ Arquitectura Final (Actualizada)
- **Función Serverless Python en Vercel**: `/api/ai/compare.py`
- **LLM**: Gemini 2.5 Flash via `emergentintegrations`
- **API Key**: `EMERGENT_LLM_KEY` (Universal Key de Emergent)
- **Sin dependencias externas**: Todo en Vercel

### Archivos Creados:
- `/api/ai/compare.py` - Función Python serverless (procesa comparativos)
- `/api/ai/extract-text.py` - Función para extraer texto de PDFs
- `/requirements.txt` - Dependencias Python (emergentintegrations, PyMuPDF)
- `/vercel.json` - Configuración de funciones Python

### ✅ Archivo de Ejemplo de Estructura (Diciembre 2025)
- **Nueva funcionalidad**: Super Admin puede subir un PDF de ejemplo por cada prompt
- **Campos nuevos en `ai_prompts`**: `example_file_name`, `example_file_content`
- **Flujo**: El texto extraído del PDF se envía a la IA como referencia de formato
- **Migración requerida**: `00018_prompt_example_file.sql`

### Variable de Entorno Requerida en Vercel:
```
EMERGENT_LLM_KEY=sk-emergent-c3c4103Ac62B474038
```

## Próximos Pasos
1. **Ejecutar migración SQL** en Supabase para agregar campos de ejemplo
2. Probar la subida de archivos de ejemplo en Super Admin
3. Verificar que la IA use el formato del ejemplo
4. Integrar Gemini para test de prompts en Super Admin
