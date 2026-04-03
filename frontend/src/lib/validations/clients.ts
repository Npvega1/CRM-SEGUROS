// =====================================================
// VALIDACIONES ZOD - Clientes
// Módulo 01: Gestión de Clientes
// Actualizado con campos: comercial_id, grupo_empresarial_id
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

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

export const ClientSegmentEnum = z.enum(['persona_natural', 'persona_juridica']);
export type ClientSegment = z.infer<typeof ClientSegmentEnum>;

// =====================================================
// SCHEMAS ZOD
// =====================================================

export const ClientSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string().min(1, 'El nombre es requerido').max(200, 'Maximo 200 caracteres'),
  doc_type: DocTypeEnum,
  doc_number: z.string().min(1, 'El documento es requerido').max(30, 'Maximo 30 caracteres'),
  email: z.string().email('Email invalido').max(150).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  segment: ClientSegmentEnum,
  agent_id: z.string().uuid().nullable().optional(),
  allied_agent_id: z.string().uuid().nullable().optional(),
  comercial_id: z.string().uuid().nullable().optional(),
  grupo_empresarial_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateClientInputSchema = z.object({
  full_name: z.string()
    .min(1, 'El nombre es requerido')
    .max(200, 'Maximo 200 caracteres'),
  doc_type: DocTypeEnum.default('cedula'),
  doc_number: z.string()
    .min(1, 'El documento es requerido')
    .max(30, 'Maximo 30 caracteres'),
  email: z.string()
    .email('Email invalido')
    .max(150, 'Maximo 150 caracteres')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .max(20, 'Maximo 20 caracteres')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .max(500, 'Maximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  segment: ClientSegmentEnum.default('persona_natural'),
  agent_id: z.string().uuid().optional().nullable(),
  allied_agent_id: z.string().uuid().optional().nullable(),
  comercial_id: z.string().uuid().optional().nullable(),
  grupo_empresarial_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const UpdateClientInputSchema = CreateClientInputSchema.partial().extend({
  is_active: z.boolean().optional()
});

export const SearchClientsInputSchema = z.object({
  query: z.string().min(1).max(100),
  segment: ClientSegmentEnum.optional(),
  agent_id: z.string().uuid().optional(),
  comercial_id: z.string().uuid().optional(),
  grupo_empresarial_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50)
});

export const CSVClientRowSchema = z.object({
  full_name: z.string().min(1).max(200),
  doc_type: DocTypeEnum.default('cedula'),
  doc_number: z.string().min(1).max(30),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  segment: ClientSegmentEnum.default('persona_natural'),
  tags: z.string().optional()
});

export const CSVRowErrorSchema = z.object({
  row: z.number(),
  field: z.string(),
  message: z.string(),
  value: z.string().optional()
});

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

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  cedula: 'Cédula de Ciudadanía',
  cedula_extranjeria: 'Cédula de Extranjería',
  carnet_diplomatico: 'Carnet Diplomático',
  consorcio: 'Consorcio',
  nit: 'NIT',
  pasaporte: 'Pasaporte',
  rut: 'RUT'
};

export const SEGMENT_LABELS: Record<ClientSegment, string> = {
  persona_natural: 'Persona Natural',
  persona_juridica: 'Persona Jurídica'
};

export const SEGMENT_COLORS: Record<ClientSegment, string> = {
  persona_natural: 'bg-blue-100 text-blue-800',
  persona_juridica: 'bg-purple-100 text-purple-800'
};
