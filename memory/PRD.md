# PRD - CRM Multi-tenant para Agencias de Seguros

## Problema Original
Desarrollo del Módulo 05 (Facturación y Comisiones) para un CRM multi-tenant de agencias de seguros.

## Stack Tecnológico
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend:** Supabase (PostgreSQL + RLS)
- **Validaciones:** Zod
- **Exports:** XLSX (sheetjs)

## Arquitectura
- Multi-tenant con RLS basado en `tenant_id` del JWT (`app_metadata`)
- Supabase Client directo (`getBrowserClient()`) - NO Server Actions ni API Routes
- Despliegue en Vercel (rama modulo04 → modulo05)

## Personas de Usuario
1. **Admin:** Gestión completa de facturación y comisiones
2. **Senior Agent:** Puede registrar pagos y marcar comisiones cobradas
3. **Agent:** Visualización de cuotas y comisiones propias
4. **Readonly:** Solo lectura

## Módulos Implementados

### ✅ Módulo 00 - Fundación
- Base del proyecto, autenticación, multi-tenancy

### ✅ Módulo 01 - Clientes y Pólizas
- CRUD de clientes y pólizas
- Storage para documentos

### ✅ Módulo 02 - Pipeline de Ventas
- Oportunidades, etapas, actividades

### ✅ Módulo 03 - Siniestros
- Gestión de reclamos/siniestros

### ✅ Módulo 04 - Reportes
- Dashboard con métricas y gráficos

### ✅ Módulo 05 - Facturación y Comisiones (NUEVO - 19/03/2026)
**Migración SQL (`00005_billing.sql`):**
- Campo `frequency` agregado a `policies`
- Tabla `invoices` (cuotas por cobrar)
- Tabla `commission_rates` (tasas de comisión)
- Tabla `commissions` (comisiones generadas)
- Tabla `commission_splits` (división de comisiones)
- Función `generate_installments()` - genera cuotas automáticamente
- Función `calculate_policy_commission()` - calcula comisión al activar póliza
- Trigger `on_policy_activated` - ejecuta funciones al activar póliza
- Función `process_overdue_invoices()` - marca cuotas vencidas (cron manual)
- RLS en todas las tablas

**Componentes UI:**
- `BillingPage` - Página principal con tabs
- `InvoicesList` - Lista de cuotas con filtros y paginación
- `PaymentModal` - Modal para registrar pagos
- `CommissionsPanel` - Panel de comisiones con exportación XLSX
- `CommissionRatesConfig` - Configuración de tasas CRUD

**Validaciones Zod:**
- Schemas para invoices, commissions, commission_rates
- Helpers para formateo de moneda, fechas, períodos

## Backlog Pendiente

### P0 - Crítico
- [ ] Ejecutar migración SQL en Supabase
- [ ] Crear bucket `invoice-documents` en Supabase Storage
- [ ] Configurar políticas de Storage para el bucket

### P1 - Módulos Siguientes
- [ ] Módulo 06 - Automatizaciones
- [ ] Módulo 07 - Portal del Cliente
- [ ] Módulo 08 - Configuración Visual

### P2 - Mejoras Pendientes
- [ ] Pólizas: permitir múltiples documentos
- [ ] Clientes: más opciones de detalle
- [ ] Exportación PDF (esperar M08)
- [ ] Notificaciones de vencimiento automáticas

## Instrucciones de Despliegue

### 1. Ejecutar Migración SQL
```sql
-- En Supabase SQL Editor, ejecutar el contenido de:
-- supabase/migrations/00005_billing.sql
```

### 2. Crear Bucket de Storage
```
1. Ir a Supabase Dashboard → Storage
2. Crear bucket "invoice-documents" (privado)
3. Ejecutar políticas de Storage del SQL
```

### 3. Desplegar en Vercel
```bash
git checkout modulo04
git checkout -b modulo05
git add .
git commit -m "feat(M05): Módulo de Facturación y Comisiones"
git push origin modulo05
```

## Última Actualización
- **Fecha:** 19 de Marzo de 2026
- **Módulo:** 05 - Facturación y Comisiones
- **Estado:** Código completo, pendiente despliegue
