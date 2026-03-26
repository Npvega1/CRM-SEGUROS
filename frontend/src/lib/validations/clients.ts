// =====================================================
// VALIDACIONES ZOD - Clientes
// Módulo 01: Gestión de Clientes
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

/**
 * Tipo de documento de identidad
 */
export const DocTypeEnum = z.enum([
  'cedula',
  'cedula_extranjeria',
  'carnet_diplomatico',
  'consorcio',
  'nit',
  'pasaporte',
  'rut'
]);
export type DocType = z.infer<typeof DocTypeEnum>;

/**
 * Segmento de cliente
 */
export const ClientSegmentEnum = z.enum(['persona_natural', 'persona_juridica']);
export type ClientSegment = z.infer<typeof ClientSegmentEnum>;

// =====================================================
// SCHEMAS ZOD
// =====================================================

/**
 * Schema completo de Cliente
 */
export const ClientSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string().min(1, 'El nombre es requerido').max(200, 'Máximo 200 caracteres'),
  doc_type: DocTypeEnum,
  doc_number: z.string().min(1, 'El documento es requerido').max(30, 'Máximo 30 caracteres'),
  email: z.string().email('Email inválido').max(150).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  segment: ClientSegmentEnum,
  agent_id: z.string().uuid().nullable().optional(),
  allied_agent_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Schema para crear un cliente
 */
export const CreateClientInputSchema = z.object({
  full_name: z.string()
    .min(1, 'El nombre es requerido')
    .max(200, 'Máximo 200 caracteres'),
  doc_type: DocTypeEnum.default('cedula'),
  doc_number: z.string()
    .min(1, 'El documento es requerido')
    .max(30, 'Máximo 30 caracteres'),
  email: z.string()
    .email('Email inválido')
    .max(150, 'Máximo 150 caracteres')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .max(20, 'Máximo 20 caracteres')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .max(500, 'Máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  segment: ClientSegmentEnum.default('persona_natural'),
  agent_id: z.string().uuid().optional().nullable(),
  allied_agent_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});

/**
 * Schema para actualizar un cliente
 */
export const UpdateClientInputSchema = CreateClientInputSchema.partial().extend({
  is_active: z.boolean().optional()
});

/**
 * Schema para búsqueda de clientes
 */
export const SearchClientsInputSchema = z.object({
  query: z.string().min(1).max(100),
  segment: ClientSegmentEnum.optional(),
  agent_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50)
});

/**
 * Schema para importación CSV
 */
export const CSVClientRowSchema = z.object({
  full_name: z.string().min(1).max(200),
  doc_type: DocTypeEnum.default('cedula'),
  doc_number: z.string().min(1).max(30),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  segment: ClientSegmentEnum.default('persona_natural'),
  tags: z.string().optional() // CSV viene como string separado por comas
});

/**
 * Error de fila en importación CSV
 */
export const CSVRowErrorSchema = z.object({
  row: z.number(),
  field: z.string(),
  message: z.string(),
  value: z.string().optional()
});

/**
 * Resultado de importación CSV
 */
export const CSVImportResultSchema = z.object({
  success: z.number(),
  failed: z.number(),
  errors: z.array(CSVRowErrorSchema)
});

// =====================================================
// TIPOS TYPESCRIPT
// =====================================================

export type Client = z.infer<typeof ClientSchema>;
export type CreateClientInput = z.infer<typeof CreateClientInputSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientInputSchema>;
export type SearchClientsInput = z.infer<typeof SearchClientsInputSchema>;
export type CSVClientRow = z.infer<typeof CSVClientRowSchema>;
export type CSVRowError = z.infer<typeof CSVRowErrorSchema>;
export type CSVImportResult = z.infer<typeof CSVImportResultSchema>;

// =====================================================
// HELPERS
// =====================================================

/**
 * Labels para tipos de documento
 */
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  cedula: 'Cédula',
  cedula_extranjeria: 'Cédula de Extranjería',
  carnet_diplomatico: 'Carnet Diplomático',
  consorcio: 'Consorcio',
  nit: 'NIT',
  pasaporte: 'Pasaporte',
  rut: 'RUT'
};

/**
 * Labels para segmentos de cliente
 */
export const SEGMENT_LABELS: Record<ClientSegment, string> = {
  persona_natural: 'Persona Natural',
  persona_juridica: 'Persona Jurídica'
};

/**
 * Colores para segmentos (Tailwind classes)
 */
export const SEGMENT_COLORS: Record<ClientSegment, string> = {
  persona_natural: 'bg-blue-100 text-blue-800',
  persona_juridica: 'bg-purple-100 text-purple-800'
};
