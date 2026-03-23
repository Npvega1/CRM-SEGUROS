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
- [🔄] Módulo 09 - Comparativos con IA (90% - funcional, pendiente ajustes de prompt)

## Módulos Pendientes
- [ ] Módulo 10 - Planes y Pagos
- [ ] Módulo 11 - Super Admin (incluye configuración de prompts por ramo)
- [ ] Módulo 12 - Agentes Aliados

## Módulo 09 - Comparativos con IA

### Funcionalidades Implementadas:
1. **Backend API asíncrono** (`/api/ai/compare`) con Gemini 2.5 Pro
2. **Procesamiento en background** - No hay timeout, archivos grandes soportados
3. **Actualización directa a Supabase** desde el backend
4. **Exportación a Word** con diseño profesional (tablas con colores, bordes)
5. **Polling automático** para detectar cuando termina el procesamiento

### Arquitectura:
```
[Vercel Frontend] 
    → Envía archivos + credenciales Supabase
    → [FastAPI Backend en Emergent]
    → Procesa en background con Gemini 2.5 Pro
    → Actualiza Supabase directamente cuando termina
    → Frontend detecta via polling
```

### Variables de Entorno en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL` - URL de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - API Key de Supabase
- `NEXT_PUBLIC_FASTAPI_BACKEND_URL` - https://quote-ai-2.preview.emergentagent.com
- `EMERGENT_LLM_KEY` - sk-emergent-c3c4103Ac62B474038

### Pendiente para Módulo 09:
- [ ] Ajustar prompt para normalizar mejor los datos extraídos
- [ ] Probar con archivos más grandes de otros ramos
- [ ] Validar exportación Word con datos reales

## Próximas Tareas

### Módulo 11 - Super Admin (Próximo):
- Configuración de **prompts personalizables por ramo** (hogar, auto, pyme, vida, etc.)
- El Super Admin crea templates de extracción de datos
- Los tenants solo usan los templates, no ven los prompts
- CRUD de templates con campos: nombre, ramo, prompt, activo/inactivo

### Backlog (P2):
- Módulo 10 - Planes y Pagos
- Módulo 12 - Agentes Aliados
- Exportar comparativo a PDF
- Compartir comparativo via Portal del Cliente
- Regenerar tipos TypeScript de Supabase

## Archivos Clave Módulo 09
- `/app/backend/server.py` - Backend FastAPI con procesamiento asíncrono
- `/app/frontend/src/app/(tenant)/ai-compare/page.tsx` - Página principal
- `/app/frontend/src/components/modules/ai-compare/ComparisonViewer.tsx` - Vista + Export Word
- `/app/frontend/supabase/migrations/00009_comparisons.sql` - Schema DB
