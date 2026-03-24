// =====================================================
// VALIDACIONES ZOD - Pólizas
// Módulo 01: Gestión de Pólizas
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

/**
 * Línea de seguro
 */
export const PolicyLineEnum = z.enum(['vida', 'auto', 'salud', 'hogar', 'soat', 'otro']);
export type PolicyLine = z.infer<typeof PolicyLineEnum>;

/**
 * Estado de póliza
 */
export const PolicyStatusEnum = z.enum(['cotizacion', 'activa', 'vencida', 'cancelada', 'renovacion']);
export type PolicyStatus = z.infer<typeof PolicyStatusEnum>;

// =====================================================
// SCHEMAS ZOD
// =====================================================

/**
 * Schema completo de Póliza
 */
export const PolicySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  client_id: z.string().uuid(),
  policy_number: z.string().min(1).max(50),
  insurer: z.string().min(1).max(100),
  line: PolicyLineEnum,
  status: PolicyStatusEnum,
  premium: z.number().min(0),
  currency: z.string().length(3).default('COP'),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  document_url: z.string().url().nullable().optional(),
  commission_pct: z.number().min(0).max(100).default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Schema para crear una póliza
 */
export const CreatePolicyInputSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  policy_number: z.string()
    .min(1, 'El número de póliza es requerido')
    .max(50, 'Máximo 50 caracteres')
    .transform(val => val.trim().toUpperCase()),
  insurer: z.string()
    .min(1, 'La aseguradora es requerida')
    .max(100, 'Máximo 100 caracteres')
    .transform(val => val.trim()),
  insurer_id: z.string().uuid().optional().nullable(),
  line: z.string().min(1, 'La línea es requerida').default('otro'),
  line_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
  status: PolicyStatusEnum.default('cotizacion'),
  premium: z.coerce.number()
    .min(0, 'La prima debe ser mayor o igual a 0'),
  currency: z.string().length(3).default('COP'),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  commission_pct: z.coerce.number()
    .min(0, 'La comisión debe ser mayor o igual a 0')
    .max(100, 'La comisión no puede ser mayor a 100%')
    .default(0),
  metadata: z.record(z.string(), z.unknown()).default({})
});

/**
 * Schema para actualizar una póliza
 */
export const UpdatePolicyInputSchema = CreatePolicyInputSchema.partial().omit({
  client_id: true
});

/**
 * Schema para actualizar estado de póliza
 */
export const UpdatePolicyStatusInputSchema = z.object({
  policy_id: z.string().uuid(),
  new_status: PolicyStatusEnum,
  note: z.string().max(500).optional()
});

/**
 * Schema para historial de póliza
 */
export const PolicyHistorySchema = z.object({
  id: z.string().uuid(),
  policy_id: z.string().uuid(),
  changed_by: z.string().uuid().nullable(),
  old_status: PolicyStatusEnum.nullable(),
  new_status: PolicyStatusEnum,
  note: z.string().nullable(),
  changed_at: z.string().datetime()
});

/**
 * Schema para alertas de vencimiento
 */
export const ExpiringPolicySchema = z.object({
  id: z.string().uuid(),
  policy_number: z.string(),
  client_id: z.string().uuid(),
  client_name: z.string(),
  insurer: z.string(),
  line: PolicyLineEnum,
  premium: z.number(),
  end_date: z.string(),
  days_until_expiry: z.number()
});

// =====================================================
// TIPOS TYPESCRIPT
// =====================================================

export type Policy = z.infer<typeof PolicySchema>;
export type CreatePolicyInput = z.infer<typeof CreatePolicyInputSchema>;
export type UpdatePolicyInput = z.infer<typeof UpdatePolicyInputSchema>;
export type UpdatePolicyStatusInput = z.infer<typeof UpdatePolicyStatusInputSchema>;
export type PolicyHistory = z.infer<typeof PolicyHistorySchema>;
export type ExpiringPolicy = z.infer<typeof ExpiringPolicySchema>;

// =====================================================
// HELPERS
// =====================================================

/**
 * Labels para líneas de seguro
 */
export const POLICY_LINE_LABELS: Record<PolicyLine, string> = {
  vida: 'Vida',
  auto: 'Auto',
  salud: 'Salud',
  hogar: 'Hogar',
  soat: 'SOAT',
  otro: 'Otro'
};

/**
 * Labels para estados de póliza
 */
export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  cotizacion: 'Cotización',
  activa: 'Activa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
  renovacion: 'En Renovación'
};

/**
 * Colores para estados de póliza (Tailwind classes)
 */
export const POLICY_STATUS_COLORS: Record<PolicyStatus, string> = {
  cotizacion: 'bg-gray-100 text-gray-800',
  activa: 'bg-green-100 text-green-800',
  vencida: 'bg-red-100 text-red-800',
  cancelada: 'bg-slate-100 text-slate-800',
  renovacion: 'bg-yellow-100 text-yellow-800'
};

/**
 * Iconos para líneas de seguro (Lucide icon names)
 */
export const POLICY_LINE_ICONS: Record<PolicyLine, string> = {
  vida: 'Heart',
  auto: 'Car',
  salud: 'Stethoscope',
  hogar: 'Home',
  soat: 'Shield',
  otro: 'FileText'
};

/**
 * Transiciones de estado válidas
 */
export const VALID_STATUS_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
  cotizacion: ['activa', 'cancelada'],
  activa: ['vencida', 'cancelada', 'renovacion'],
  vencida: ['renovacion', 'cancelada'],
  renovacion: ['activa', 'cancelada'],
  cancelada: []
};

/**
 * Verifica si una transición de estado es válida
 */
export function isValidStatusTransition(
  currentStatus: PolicyStatus,
  newStatus: PolicyStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

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
