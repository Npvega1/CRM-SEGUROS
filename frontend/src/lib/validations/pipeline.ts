// =====================================================
// VALIDACIONES ZOD - Pipeline de Ventas
// Módulo 02: Pipeline y Oportunidades
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';
import { PolicyLineEnum } from './policies';

// =====================================================
// ENUMS
// =====================================================

/**
 * Estado de oportunidad
 */
export const OpportunityStatusEnum = z.enum(['active', 'won', 'lost']);
export type OpportunityStatus = z.infer<typeof OpportunityStatusEnum>;

/**
 * Tipo de actividad
 */
export const ActivityTypeEnum = z.enum(['call', 'email', 'meeting', 'task', 'note']);
export type ActivityType = z.infer<typeof ActivityTypeEnum>;

// =====================================================
// SCHEMAS ZOD - Pipeline Stages
// =====================================================

/**
 * Schema completo de PipelineStage
 */
export const PipelineStageSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  order_index: z.number().int().min(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser hexadecimal válido'),
  is_default: z.boolean().default(false),
  created_at: z.string().datetime()
});

/**
 * Schema para crear una etapa
 */
export const CreateStageInputSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'Máximo 100 caracteres'),
  order_index: z.number().int().min(0),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser hexadecimal válido')
    .default('#6B7280')
});

/**
 * Schema para actualizar una etapa
 */
export const UpdateStageInputSchema = CreateStageInputSchema.partial();

// =====================================================
// SCHEMAS ZOD - Opportunities
// =====================================================

/**
 * Schema completo de Opportunity
 */
export const OpportunitySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  client_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable().optional(),
  line: PolicyLineEnum,
  estimated_premium: z.number().min(0),
  close_probability: z.number().int().min(0).max(100),
  expected_close_date: z.string().nullable().optional(),
  status: OpportunityStatusEnum,
  lost_reason: z.string().nullable().optional(),
  converted_policy_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Schema para crear una oportunidad
 */
export const CreateOpportunityInputSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  stage_id: z.string().uuid('Etapa inválida'),
  agent_id: z.string().uuid().optional().nullable(),
  line: PolicyLineEnum.default('otro'),
  estimated_premium: z.coerce.number()
    .min(0, 'La prima debe ser mayor o igual a 0'),
  close_probability: z.coerce.number()
    .int()
    .min(0, 'La probabilidad debe ser al menos 0%')
    .max(100, 'La probabilidad no puede ser mayor a 100%')
    .default(50),
  expected_close_date: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
});

/**
 * Schema para actualizar una oportunidad
 */
export const UpdateOpportunityInputSchema = CreateOpportunityInputSchema.partial();

/**
 * Schema para mover oportunidad de etapa
 */
export const MoveStageInputSchema = z.object({
  opportunity_id: z.string().uuid(),
  new_stage_id: z.string().uuid()
});

/**
 * Schema para ganar oportunidad
 */
export const WinOpportunityInputSchema = z.object({
  opportunity_id: z.string().uuid(),
  policy_number: z.string().max(50).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  commission_pct: z.coerce.number().min(0).max(100).default(10)
});

/**
 * Schema para perder oportunidad
 */
export const LoseOpportunityInputSchema = z.object({
  opportunity_id: z.string().uuid(),
  lost_reason: z.string()
    .min(1, 'La razón de pérdida es obligatoria')
    .max(500, 'Máximo 500 caracteres')
});

// =====================================================
// SCHEMAS ZOD - Activities
// =====================================================

/**
 * Schema completo de Activity
 */
export const ActivitySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  opportunity_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  agent_id: z.string().uuid().nullable().optional(),
  type: ActivityTypeEnum,
  subject: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime()
});

/**
 * Schema para crear una actividad
 */
export const CreateActivityInputSchema = z.object({
  opportunity_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  type: ActivityTypeEnum,
  subject: z.string()
    .min(1, 'El asunto es requerido')
    .max(200, 'Máximo 200 caracteres'),
  description: z.string().max(2000).optional().nullable(),
  scheduled_at: z.string().optional().nullable()
}).refine(
  (data) => data.opportunity_id || data.client_id,
  { message: 'Debe especificar una oportunidad o un cliente' }
);

/**
 * Schema para actualizar una actividad
 */
export const UpdateActivityInputSchema = z.object({
  type: ActivityTypeEnum.optional(),
  subject: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable()
});

// =====================================================
// SCHEMAS ZOD - Forecast
// =====================================================

/**
 * Schema para parámetros de forecast
 */
export const ForecastParamsSchema = z.object({
  period: z.enum(['monthly', 'quarterly']).default('monthly'),
  agent_id: z.string().uuid().optional().nullable(),
  months_ahead: z.number().int().min(1).max(12).default(6)
});

/**
 * Schema de respuesta de forecast
 */
export const ForecastItemSchema = z.object({
  forecast_month: z.string(),
  stage_id: z.string().uuid(),
  stage_name: z.string(),
  agent_id: z.string().uuid().nullable(),
  opportunity_count: z.number().int(),
  total_premium: z.number(),
  weighted_premium: z.number(),
  avg_probability: z.number()
});

// =====================================================
// TIPOS TYPESCRIPT
// =====================================================

export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type CreateStageInput = z.infer<typeof CreateStageInputSchema>;
export type UpdateStageInput = z.infer<typeof UpdateStageInputSchema>;

export type Opportunity = z.infer<typeof OpportunitySchema>;
export type CreateOpportunityInput = z.infer<typeof CreateOpportunityInputSchema>;
export type UpdateOpportunityInput = z.infer<typeof UpdateOpportunityInputSchema>;
export type MoveStageInput = z.infer<typeof MoveStageInputSchema>;
export type WinOpportunityInput = z.infer<typeof WinOpportunityInputSchema>;
export type LoseOpportunityInput = z.infer<typeof LoseOpportunityInputSchema>;

export type Activity = z.infer<typeof ActivitySchema>;
export type CreateActivityInput = z.infer<typeof CreateActivityInputSchema>;
export type UpdateActivityInput = z.infer<typeof UpdateActivityInputSchema>;

export type ForecastParams = z.infer<typeof ForecastParamsSchema>;
export type ForecastItem = z.infer<typeof ForecastItemSchema>;

// =====================================================
// TIPOS EXTENDIDOS PARA UI
// =====================================================

/**
 * Oportunidad con datos relacionados (para mostrar en UI)
 */
export interface OpportunityWithRelations extends Opportunity {
  client?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    segment: string;
  };
  agent?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  stage?: PipelineStage;
  activities_count?: number;
}

/**
 * Columna del Kanban
 */
export interface KanbanColumn {
  stage: PipelineStage;
  opportunities: OpportunityWithRelations[];
  totalPremium: number;
  count: number;
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Labels para estados de oportunidad
 */
export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  active: 'Activa',
  won: 'Ganada',
  lost: 'Perdida'
};

/**
 * Colores para estados de oportunidad (Tailwind classes)
 */
export const OPPORTUNITY_STATUS_COLORS: Record<OpportunityStatus, string> = {
  active: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800'
};

/**
 * Labels para tipos de actividad
 */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Llamada',
  email: 'Email',
  meeting: 'Reunión',
  task: 'Tarea',
  note: 'Nota'
};

/**
 * Iconos para tipos de actividad (Lucide icon names)
 */
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  call: 'Phone',
  email: 'Mail',
  meeting: 'Users',
  task: 'CheckSquare',
  note: 'FileText'
};

/**
 * Colores para tipos de actividad (Tailwind classes)
 */
export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  call: 'bg-green-100 text-green-800',
  email: 'bg-blue-100 text-blue-800',
  meeting: 'bg-purple-100 text-purple-800',
  task: 'bg-amber-100 text-amber-800',
  note: 'bg-gray-100 text-gray-800'
};

/**
 * Formatea el valor de la prima con moneda
 */
export function formatPremium(premium: number, currency: string = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(premium);
}

/**
 * Formatea fecha para mostrar
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formatea fecha y hora para mostrar
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calcula la prima ponderada
 */
export function calculateWeightedPremium(premium: number, probability: number): number {
  return premium * (probability / 100);
}

/**
 * Obtiene el color de probabilidad (para barras de progreso)
 */
export function getProbabilityColor(probability: number): string {
  if (probability >= 75) return 'bg-green-500';
  if (probability >= 50) return 'bg-yellow-500';
  if (probability >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}
