// =====================================================
// VALIDACIONES: Módulo Super Admin
// Esquemas Zod para validación de datos
// =====================================================

import { z } from 'zod';

// =====================================================
// SCHEMAS PARA PROMPTS DE IA
// =====================================================

export const promptStatusSchema = z.enum(['active', 'draft', 'deprecated']);

export const aiPromptSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100),
  line: z.string().max(50).nullable().optional(),
  prompt_system: z.string().min(10, 'El prompt de sistema debe tener al menos 10 caracteres'),
  prompt_recommendation: z.string().min(10, 'El prompt de recomendación debe tener al menos 10 caracteres'),
  model_id: z.string().default('claude-sonnet-4-5-20250929'),
  status: promptStatusSchema.default('draft'),
  version: z.number().int().positive().default(1),
});

export const createPromptSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100),
  line: z.string().max(50).nullable().optional(),
  prompt_system: z.string().min(10, 'El prompt de sistema debe tener al menos 10 caracteres'),
  prompt_recommendation: z.string().min(10, 'El prompt de recomendación debe tener al menos 10 caracteres'),
  model_id: z.string().default('claude-sonnet-4-5-20250929'),
  status: promptStatusSchema.default('draft'),
});
export const updatePromptSchema = aiPromptSchema.partial().required({ id: true });

// =====================================================
// SCHEMAS PARA TENANTS
// =====================================================

export const tenantFiltersSchema = z.object({
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const createTenantSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  slug: z.string()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones'),
  admin_email: z.string().email('Email inválido'),
  admin_name: z.string().min(2, 'El nombre del admin debe tener al menos 2 caracteres'),
  admin_password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const suspendTenantSchema = z.object({
  tenant_id: z.string().uuid(),
  message: z.string().optional(),
});

// =====================================================
// SCHEMAS PARA ANALYTICS
// =====================================================

export const analyticsDateRangeSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// =====================================================
// SCHEMAS PARA AUDIT LOGS
// =====================================================

export const auditLogsFiltersSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  action: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
});

// =====================================================
// SCHEMAS PARA TEST DE PROMPTS
// =====================================================

export const testPromptSchema = z.object({
  prompt_id: z.string().uuid(),
  sample_text: z.string().min(10, 'El texto de prueba debe tener al menos 10 caracteres'),
});

// =====================================================
// TIPOS INFERIDOS
// =====================================================

export type PromptStatus = z.infer<typeof promptStatusSchema>;
export type AiPrompt = z.infer<typeof aiPromptSchema>;
export type CreatePromptInput = z.infer<typeof createPromptSchema>;
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;
export type TenantFilters = z.infer<typeof tenantFiltersSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type SuspendTenantInput = z.infer<typeof suspendTenantSchema>;
export type AuditLogsFilters = z.infer<typeof auditLogsFiltersSchema>;
export type TestPromptInput = z.infer<typeof testPromptSchema>;

// =====================================================
// MODELOS CLAUDE DISPONIBLES
// =====================================================

export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Equilibrio calidad/costo' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Máxima calidad' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Rápido y económico' },
] as const;

// =====================================================
// RAMOS DE SEGURO
// =====================================================

export const INSURANCE_LINES = [
  { value: null, label: 'Todos los ramos' },
  { value: 'auto', label: 'Automóvil' },
  { value: 'vida', label: 'Vida' },
  { value: 'salud', label: 'Salud' },
  { value: 'hogar', label: 'Hogar' },
  { value: 'negocio', label: 'Negocio/Empresa' },
  { value: 'responsabilidad', label: 'Responsabilidad Civil' },
  { value: 'viaje', label: 'Viaje' },
] as const;

// =====================================================
// VARIABLES DISPONIBLES PARA PROMPTS
// =====================================================

export const PROMPT_VARIABLES = [
  { key: '{ramo}', description: 'Ramo del seguro (auto, vida, salud, etc.)' },
  { key: '{num_aseguradoras}', description: 'Número de aseguradoras a comparar' },
  { key: '{criterios}', description: 'Criterios de comparación seleccionados' },
  { key: '{idioma}', description: 'Idioma de la respuesta (español por defecto)' },
  { key: '{cliente_nombre}', description: 'Nombre del cliente' },
  { key: '{cotizaciones}', description: 'JSON con datos de las cotizaciones' },
] as const;
