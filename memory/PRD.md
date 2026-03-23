# CRM Multi-tenant para Agencias de Seguros - PRD

## Estado del Proyecto
**Fecha última actualización:** 2026-03-23

## Stack Tecnológico
- Next.js 14, Supabase, TypeScript, Tailwind CSS, Shadcn/UI, Zod
- FastAPI Backend (para procesamiento IA)
- Gemini 2.5 Flash via Emergent LLM Key

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
- [✓] Módulo 09 - Comparativos con IA (COMPLETADO 2026-03-23)

## Módulos Pendientes
- [ ] Módulo 10 - Planes y Pagos
- [ ] Módulo 11 - Super Admin (incluye configuración de templates IA por ramo)
- [ ] Módulo 12 - Agentes Aliados

## Implementación del Módulo 09 - Comparativos con IA

### Funcionalidades Implementadas:
1. **Backend API** (`/api/ai/compare`) usando Gemini 2.5 Flash via Emergent LLM Key
2. **Proxy API Route** (`/app/api/ai/compare/route.ts`) para compatibilidad con Vercel
3. **Página principal** `/ai-compare` con:
   - Barra de progreso de uso mensual (10 comparativos/mes)
   - Lista de comparativos con estados (procesando, listo, error)
   - Wizard de 3 pasos para crear nuevo comparativo
   - Procesamiento en segundo plano (non-blocking)
4. **Nueva Estructura de Tabla Comparativa** con secciones:
   - Información del Riesgo (cliente, dirección, ciudad, descripción)
   - Valores Asegurados (tabla)
   - Amparos/Coberturas (tabla con límites)
   - Deducibles (tabla)
   - Beneficios Adicionales (lista)
   - Prima (total anual + forma de pago)
5. **Exportación a Word (.docx)** con formato profesional
6. **Soporte para Prospectos** (clientes no registrados)
7. **Migración SQL** con tablas: comparisons, comparison_files, comparison_criteria, usage_logs

### Arquitectura de Despliegue:
```
[Vercel Frontend] 
    → /api/ai/compare (Next.js API Route - Proxy)
    → [FastAPI Backend en Emergent]
    → Gemini 2.5 Flash
```

### Variables de Entorno Requeridas en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `FASTAPI_BACKEND_URL` (URL del backend Emergent)
- `EMERGENT_LLM_KEY` (sk-emergent-c3c4103Ac62B474038)

## Próximas Tareas (P0)
1. **Probar en Vercel** - Usuario debe verificar funcionalidad en su ambiente
2. **Módulo 11 - Super Admin** (P1):
   - Configuración de templates de comparación por ramo
   - Tenants pueden habilitar/deshabilitar templates

## Backlog (P1/P2)
- Módulo 10 - Planes y Pagos
- Módulo 12 - Agentes Aliados
- Exportar comparativo a PDF
- Compartir comparativo con cliente via portal
- Integrar servicio de email real (Resend/SendGrid)
- Implementar Magic Link OTP real
- Regenerar tipos TypeScript de Supabase (eliminar `as any` casts)
