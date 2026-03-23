# CRM Multi-tenant para Agencias de Seguros - PRD

## Estado del Proyecto
**Fecha última actualización:** 2026-01-23

## Stack Tecnológico
- Next.js 14, Supabase, TypeScript, Tailwind CSS, Shadcn/UI, Zod

## Módulos Completados
- [✓] Módulo 00 - Fundación
- [✓] Módulo 01 - Clientes y Pólizas
- [✓] Módulo 02 - Pipeline de Ventas
- [✓] Módulo 03 - Siniestros
- [✓] Módulo 04 - Reportes y Analytics
- [✓] Módulo 05 - Facturación y Comisiones
- [✓] Módulo 06 - Automatizaciones y Workflows
- [✓] Módulo 07 - Portal del Cliente
- [✓] Módulo 08 - Configuración Visual
- [✓] Módulo 09 - Comparativos con IA (NUEVO - Implementado hoy)

## Módulos Pendientes
- [ ] Módulo 10 - Planes y Pagos
- [ ] Módulo 11 - Super Admin
- [ ] Módulo 12 - Agentes Aliados

## Implementación del Módulo 09 - Comparativos con IA

### Lo que se implementó:
1. **Backend API** (`/api/ai/compare`) usando Gemini 2.5 Flash via Emergent LLM Key
2. **Página principal** `/ai-compare` con:
   - Barra de progreso de uso mensual (10 comparativos/mes)
   - Lista de comparativos anteriores
   - Wizard de 3 pasos para crear nuevo comparativo
3. **Componentes UI**:
   - NewComparisonWizard (selección cliente/ramo, upload archivos, confirmación)
   - ComparisonViewer (tabla editable, recomendación IA, exportar Excel)
   - UsageProgress, ClientSearchSelect, ComparisonsList
4. **Migración SQL** con tablas: comparisons, comparison_files, comparison_criteria, usage_logs
5. **Validaciones Zod** y tipos TypeScript estrictos
6. **Integración al sidebar** con badge "Nuevo"

### Pendiente para funcionar:
- Ejecutar migración SQL en Supabase
- Crear bucket `comparison-documents` en Storage
- Configurar políticas RLS de Storage

## Próximas Tareas (P0)
1. Módulo 10 - Planes y Pagos (límites de uso, suscripciones)
2. Módulo 11 - Super Admin (gestión de tenants)

## Backlog (P1/P2)
- Módulo 12 - Agentes Aliados
- Exportar comparativo a PDF
- Compartir comparativo con cliente via portal
- Integrar servicio de email real (Resend/SendGrid)
- Implementar Magic Link OTP real
