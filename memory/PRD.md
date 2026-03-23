# CRM Multi-tenant para Agencias de Seguros - PRD

## Estado del Proyecto
**Fecha última actualización:** 2026-03-23

## Stack Tecnológico
- Next.js 14, Supabase, TypeScript, Tailwind CSS, Shadcn/UI, Zod
- FastAPI Backend (para procesamiento IA)
- **Gemini 2.5 Pro** via Emergent LLM Key (~$0.04 USD por comparativo)

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
- [✓] Módulo 09 - Comparativos con IA (COMPLETO)

## Módulos Pendientes
- [ ] Módulo 10 - Planes y Pagos
- [ ] Módulo 11 - Super Admin (incluye configuración de prompts por ramo)
- [ ] Módulo 12 - Agentes Aliados

## Módulo 09 - Comparativos con IA (FINALIZADO)

### Funcionalidades Implementadas:
1. **Backend API asíncrono** (`/api/ai/compare`) con Gemini 2.5 Pro
2. **Procesamiento en background** - No hay timeout, archivos grandes soportados
3. **Actualización directa a Supabase** desde el backend con service_role key
4. **Exportación a Word** con diseño profesional (tablas con colores, bordes)
5. **Polling automático mejorado** con detección de cambios de estado y notificaciones toast
6. **SIN sección de "Recomendación AI"** - eliminada por solicitud del usuario

### Arquitectura:
```
[Vercel Frontend] 
    → Envía archivos + credenciales Supabase
    → [FastAPI Backend en Emergent]
    → Procesa en background con Gemini 2.5 Pro (UNA sola llamada)
    → Actualiza Supabase directamente cuando termina
    → Frontend detecta via polling y muestra toast
```

### Cambios Recientes (2026-03-23):
1. **Eliminada sección "AI Recommendation"** del UI, Word export y backend
2. **Optimizado polling del frontend** - ahora detecta cambios de estado y muestra toasts
3. **Reducido costo de API** - solo 1 llamada a Gemini (antes eran 2)

### Variables de Entorno Requeridas:

**Frontend (Vercel):**
- `NEXT_PUBLIC_SUPABASE_URL` - URL de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - API Key de Supabase
- `NEXT_PUBLIC_FASTAPI_BACKEND_URL` - https://quote-ai-2.preview.emergentagent.com

**Backend (Emergent/FastAPI):**
- `SUPABASE_URL` - URL de Supabase
- `SUPABASE_SERVICE_KEY` - Service Role Key para bypass de RLS
- `EMERGENT_LLM_KEY` - Clave universal de Emergent para LLMs

## Próximas Tareas

### Módulo 11 - Super Admin (Siguiente):
- Configuración de **prompts personalizables por ramo** (hogar, auto, pyme, vida, etc.)
- El Super Admin crea templates de extracción de datos
- Los tenants solo usan los templates, no ven los prompts
- CRUD de templates con campos: nombre, ramo, prompt, activo/inactivo

### Backlog P1:
- Regenerar tipos TypeScript de Supabase (`database.types.ts`)
- Módulo 10 - Planes y Pagos
- Módulo 12 - Agentes Aliados

### Backlog P2:
- Exportar comparativo a PDF
- Compartir comparativo via Portal del Cliente
- Integración email real (Resend/SendGrid)
- Magic Link OTP real para portal de clientes

## Archivos Clave Módulo 09
- `/app/backend/server.py` - Backend FastAPI con procesamiento asíncrono
- `/app/frontend/src/app/(tenant)/ai-compare/page.tsx` - Página principal con polling mejorado
- `/app/frontend/src/components/modules/ai-compare/ComparisonViewer.tsx` - Vista + Export Word (sin recomendación)
- `/app/frontend/src/lib/services/comparison-service.ts` - Servicios de Supabase
- `/app/frontend/supabase/migrations/00009_comparisons.sql` - Schema DB
