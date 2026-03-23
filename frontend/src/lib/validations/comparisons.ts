// =====================================================
// VALIDACIONES ZOD - Comparativos con IA
// Módulo 09: Cuadros Comparativos de Cotizaciones
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';
import { PolicyLineEnum, type PolicyLine } from './policies';

// =====================================================
// ENUMS
// =====================================================

/**
 * Estado del comparativo
 */
export const ComparisonStatusEnum = z.enum(['processing', 'ready', 'error', 'exported']);
export type ComparisonStatus = z.infer<typeof ComparisonStatusEnum>;

/**
 * Estado de extracción de archivo
 */
export const ExtractionStatusEnum = z.enum(['pending', 'processing', 'done', 'error']);
export type ExtractionStatus = z.infer<typeof ExtractionStatusEnum>;

/**
 * Tipo de archivo permitido
 */
export const FileTypeEnum = z.enum(['pdf', 'docx']);
export type FileType = z.infer<typeof FileTypeEnum>;

// =====================================================
// SCHEMAS ZOD
// =====================================================

/**
 * Schema para un criterio de comparación
 */
export const ComparisonCriteriaSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  line: PolicyLineEnum,
  criteria_name: z.string().min(1).max(100),
  order_index: z.number().int().min(0),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional()
});

/**
 * Schema para un archivo de comparación
 */
export const ComparisonFileSchema = z.object({
  id: z.string().uuid(),
  comparison_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  original_name: z.string().max(200),
  file_url: z.string(),
  file_type: FileTypeEnum,
  extraction_status: ExtractionStatusEnum.default('pending'),
  extracted_text: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  uploaded_at: z.string().datetime()
});

/**
 * Schema para datos extraídos de una aseguradora
 */
export const InsurerDataSchema = z.object({
  name: z.string(),
  fields: z.record(z.string(), z.object({
    value: z.string(),
    notes: z.string().optional()
  }))
});

/**
 * Schema para la tabla comparativa
 */
export const ComparisonTableSchema = z.object({
  criteria: z.array(z.string()),
  insurers: z.array(InsurerDataSchema)
});

/**
 * Schema completo de Comparativo
 */
export const ComparisonSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  client_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  line: PolicyLineEnum,
  source_files: z.array(z.string()).default([]),
  extracted_data: z.record(z.string(), z.unknown()).nullable().optional(),
  comparison_table: ComparisonTableSchema.nullable().optional(),
  ai_recommendation: z.string().nullable().optional(),
  status: ComparisonStatusEnum.default('processing'),
  error_message: z.string().nullable().optional(),
  pdf_url: z.string().nullable().optional(),
  xlsx_url: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Schema para crear un comparativo
 */
export const CreateComparisonInputSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  line: PolicyLineEnum,
  files: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    base64: z.string()
  })).min(2, 'Se requieren al menos 2 cotizaciones').max(8, 'Máximo 8 cotizaciones')
});

/**
 * Schema para actualizar una celda
 */
export const UpdateComparisonCellInputSchema = z.object({
  comparison_id: z.string().uuid(),
  insurer_key: z.string(),
  criteria_key: z.string(),
  new_value: z.string()
});

/**
 * Schema para uso mensual
 */
export const UsageLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  feature: z.string().max(50),
  count_date: z.string(),
  usage_count: z.number().int().default(0)
});

/**
 * Schema para la respuesta de Claude AI
 */
export const AIComparisonResponseSchema = z.object({
  insurers: z.array(z.object({
    name: z.string(),
    fields: z.record(z.string(), z.object({
      value: z.string(),
      notes: z.string().optional()
    }))
  }))
});

// =====================================================
// TIPOS TYPESCRIPT
// =====================================================

export type ComparisonCriteria = z.infer<typeof ComparisonCriteriaSchema>;
export type ComparisonFile = z.infer<typeof ComparisonFileSchema>;
export type InsurerData = z.infer<typeof InsurerDataSchema>;
export type ComparisonTable = z.infer<typeof ComparisonTableSchema>;
export type Comparison = z.infer<typeof ComparisonSchema>;
export type CreateComparisonInput = z.infer<typeof CreateComparisonInputSchema>;
export type UpdateComparisonCellInput = z.infer<typeof UpdateComparisonCellInputSchema>;
export type UsageLog = z.infer<typeof UsageLogSchema>;
export type AIComparisonResponse = z.infer<typeof AIComparisonResponseSchema>;

/**
 * Comparativo con relaciones
 */
export interface ComparisonWithRelations extends Comparison {
  client?: {
    id: string;
    full_name: string;
    email: string | null;
  };
  agent?: {
    id: string;
    full_name: string;
  };
  files?: ComparisonFile[];
}

/**
 * Estadísticas de uso
 */
export interface UsageStats {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Labels para estados de comparativo
 */
export const COMPARISON_STATUS_LABELS: Record<ComparisonStatus, string> = {
  processing: 'Procesando',
  ready: 'Listo',
  error: 'Error',
  exported: 'Exportado'
};

/**
 * Colores para estados de comparativo
 */
export const COMPARISON_STATUS_COLORS: Record<ComparisonStatus, string> = {
  processing: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  exported: 'bg-blue-100 text-blue-800'
};

/**
 * Criterios de comparación por defecto
 */
export const DEFAULT_COMPARISON_CRITERIA: Record<PolicyLine, string[]> = {
  vida: ['Prima Anual', 'Suma Asegurada', 'Cobertura Principal', 'Beneficiarios', 'Exclusiones', 'Vigencia'],
  auto: ['Prima Anual', 'Valor Asegurado', 'Cobertura Daños', 'Responsabilidad Civil', 'Deducible', 'Asistencia'],
  salud: ['Prima Mensual', 'Cobertura Hospitalaria', 'Cobertura Ambulatoria', 'Red de Clínicas', 'Copago', 'Preexistencias'],
  hogar: ['Prima Anual', 'Valor Edificación', 'Valor Contenido', 'Cobertura Incendio', 'Robo/Hurto', 'Responsabilidad Civil'],
  soat: ['Prima', 'Cobertura Médica', 'Gastos Funerarios', 'Incapacidad', 'Vigencia', 'Aseguradora'],
  otro: ['Prima', 'Cobertura Principal', 'Deducible', 'Exclusiones', 'Vigencia', 'Condiciones Especiales']
};

/**
 * Límite mensual por defecto
 */
export const DEFAULT_MONTHLY_LIMIT = 10;

/**
 * Tipos MIME permitidos
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * Extensiones permitidas
 */
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

/**
 * Tamaño máximo de archivo (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Obtiene el tipo de archivo de un nombre
 */
export function getFileType(fileName: string): FileType | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  return null;
}

/**
 * Valida si un archivo es permitido
 */
export function isValidFile(file: File): { valid: boolean; error?: string } {
  const fileType = getFileType(file.name);
  if (!fileType) {
    return { valid: false, error: 'Tipo de archivo no permitido. Solo PDF y DOCX.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'El archivo excede el tamaño máximo de 10MB.' };
  }
  return { valid: true };
}

/**
 * Formatea el tamaño de archivo
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
