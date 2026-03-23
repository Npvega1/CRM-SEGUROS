# Módulo 09 - Comparativos con IA

## Descripción
Este módulo permite generar cuadros comparativos de cotizaciones de seguros utilizando Inteligencia Artificial (Gemini 2.5 Flash via Emergent LLM Key).

## Archivos Creados

### Frontend
- `src/app/(tenant)/ai-compare/page.tsx` - Página principal del módulo
- `src/components/modules/ai-compare/` - Carpeta con componentes:
  - `index.ts` - Exports
  - `UsageProgress.tsx` - Barra de progreso de uso mensual
  - `ComparisonsList.tsx` - Lista de comparativos anteriores
  - `NewComparisonWizard.tsx` - Wizard de 3 pasos para crear comparativo
  - `ClientSearchSelect.tsx` - Selector de cliente con búsqueda
  - `ComparisonViewer.tsx` - Visualizador de tabla comparativa editable
- `src/lib/services/comparison-service.ts` - Servicio de comparativos
- `src/lib/validations/comparisons.ts` - Validaciones Zod y tipos TypeScript
- `src/components/ui/progress.tsx` - Componente Progress actualizado a TypeScript

### Backend
- `backend/server.py` - Endpoint `/api/ai/compare` agregado

### Migración SQL
- `supabase/migrations/00009_comparisons.sql` - Tablas:
  - `comparisons` - Comparativos generados
  - `comparison_files` - Archivos de cotización
  - `comparison_criteria` - Criterios configurables por ramo
  - `usage_logs` - Control de uso mensual

## Archivos Modificados
- `src/app/(tenant)/layout.tsx` - Agregado ítem "Comparativos IA" al sidebar
- `src/lib/hooks/usePermissions.ts` - Agregado permiso "comparativos"
- `frontend/.env` - Agregado NEXT_PUBLIC_BACKEND_URL
- `backend/.env` - Agregado EMERGENT_LLM_KEY

## Configuración Requerida

### 1. Ejecutar Migración SQL
Ejecutar en Supabase el archivo `supabase/migrations/00009_comparisons.sql`

### 2. Crear Bucket de Storage
En Supabase Storage, crear bucket privado: `comparison-documents`

### 3. Política RLS de Storage
```sql
CREATE POLICY "comparison_documents_policy" ON storage.objects
FOR ALL USING (
  bucket_id = 'comparison-documents' AND
  (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);
```

## Funcionalidades Implementadas

### Creación de Comparativos
1. Seleccionar cliente y ramo de seguro
2. Subir 2-8 cotizaciones (PDF o DOCX)
3. La IA analiza y extrae información automáticamente
4. Genera tabla comparativa + recomendación

### Visualización
- Tabla editable con resaltado del mejor valor
- Recomendación de IA editable
- Exportar a Excel (XLSX)
- Botón para crear póliza desde cotización

### Control de Uso
- Límite de 10 comparativos mensuales (gratuito)
- Barra de progreso visible
- Alerta al acercarse al límite

## Criterios de Comparación por Defecto

| Ramo | Criterios |
|------|-----------|
| Vida | Prima Anual, Suma Asegurada, Cobertura Principal, Beneficiarios, Exclusiones, Vigencia |
| Auto | Prima Anual, Valor Asegurado, Cobertura Daños, Responsabilidad Civil, Deducible, Asistencia |
| Salud | Prima Mensual, Cobertura Hospitalaria, Cobertura Ambulatoria, Red de Clínicas, Copago, Preexistencias |
| Hogar | Prima Anual, Valor Edificación, Valor Contenido, Cobertura Incendio, Robo/Hurto, RC |
| SOAT | Prima, Cobertura Médica, Gastos Funerarios, Incapacidad, Vigencia, Aseguradora |

## Tecnologías Usadas
- Gemini 2.5 Flash (via Emergent LLM Key)
- react-dropzone para upload de archivos
- xlsx (sheetjs) para exportar a Excel
- date-fns para formateo de fechas
