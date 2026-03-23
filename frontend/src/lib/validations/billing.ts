// =====================================================
// VALIDACIONES ZOD - Facturación y Comisiones
// Módulo 05: Billing
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

/**
 * Estado de factura/cuota
 */
export const InvoiceStatusEnum = z.enum(['pending', 'paid', 'overdue', 'waived']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

/**
 * Frecuencia de pago
 */
export const PaymentFrequencyEnum = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);
export type PaymentFrequency = z.infer<typeof PaymentFrequencyEnum>;

/**
 * Estado de comisión
 */
export const CommissionStatusEnum = z.enum(['pending', 'collected', 'void']);
export type CommissionStatus = z.infer<typeof CommissionStatusEnum>;

/**
 * Línea de seguro (ramo)
 */
export const PolicyLineEnum = z.enum(['vida', 'auto', 'salud', 'hogar', 'soat', 'otro']);
export type PolicyLine = z.infer<typeof PolicyLineEnum>;

// =====================================================
// SCHEMAS ZOD - Invoices
// =====================================================

/**
 * Schema completo de Invoice (cuota)
 */
export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  client_id: z.string().uuid(),
  amount: z.number().min(0),
  due_date: z.string(),
  status: InvoiceStatusEnum,
  paid_date: z.string().nullable().optional(),
  receipt_url: z.string().nullable().optional(),
  frequency: PaymentFrequencyEnum,
  installment_number: z.number().int().min(1),
  total_installments: z.number().int().min(1),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Invoice con relaciones para UI
 */
export interface InvoiceWithRelations {
  id: string;
  tenant_id: string;
  policy_id: string;
  client_id: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  paid_date: string | null;
  receipt_url: string | null;
  frequency: PaymentFrequency;
  installment_number: number;
  total_installments: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  policy?: {
    id: string;
    policy_number: string;
    insurer: string;
    line: string;
  };
  client?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
}

/**
 * Schema para registrar pago
 */
export const RecordPaymentInputSchema = z.object({
  invoice_id: z.string().uuid('ID de cuota inválido'),
  paid_date: z.string().min(1, 'La fecha de pago es requerida'),
  receipt_url: z.string().url().nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentInputSchema>;

// =====================================================
// SCHEMAS ZOD - Commission Rates
// =====================================================

/**
 * Schema completo de CommissionRate
 */
export const CommissionRateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  insurer: z.string(),
  line: PolicyLineEnum,
  rate_pct: z.number().min(0).max(100),
  effective_from: z.string(),
  effective_to: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type CommissionRate = z.infer<typeof CommissionRateSchema>;

/**
 * Schema para crear/actualizar tasa de comisión
 */
export const CommissionRateInputSchema = z.object({
  insurer: z.string()
    .min(1, 'La aseguradora es requerida')
    .max(100, 'Máximo 100 caracteres'),
  line: PolicyLineEnum,
  rate_pct: z.coerce.number()
    .min(0, 'La tasa debe ser mayor o igual a 0')
    .max(100, 'La tasa no puede ser mayor a 100%'),
  effective_from: z.string().min(1, 'La fecha de inicio es requerida'),
  effective_to: z.string().nullable().optional()
});

export type CommissionRateInput = z.infer<typeof CommissionRateInputSchema>;

// =====================================================
// SCHEMAS ZOD - Commissions
// =====================================================

/**
 * Schema completo de Commission
 */
export const CommissionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable().optional(),
  amount: z.number().min(0),
  rate_pct: z.number().min(0).max(100),
  status: CommissionStatusEnum,
  period_month: z.string(),
  paid_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type Commission = z.infer<typeof CommissionSchema>;

/**
 * Comisión con relaciones para UI
 */
export interface CommissionWithRelations {
  id: string;
  policy_id: string;
  policy_number: string;
  client_name: string;
  insurer: string;
  line: string;
  agent_id: string | null;
  agent_name: string | null;
  amount: number;
  rate_pct: number;
  status: CommissionStatus;
  period_month: string;
  paid_at: string | null;
  premium: number;
}

/**
 * Schema para marcar comisión como cobrada
 */
export const MarkCommissionCollectedInputSchema = z.object({
  commission_id: z.string().uuid('ID de comisión inválido'),
  paid_at: z.string().min(1, 'La fecha de cobro es requerida'),
  notes: z.string().max(500).nullable().optional()
});

export type MarkCommissionCollectedInput = z.infer<typeof MarkCommissionCollectedInputSchema>;

// =====================================================
// SCHEMAS ZOD - Commission Splits
// =====================================================

/**
 * Schema de CommissionSplit
 */
export const CommissionSplitSchema = z.object({
  id: z.string().uuid(),
  commission_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  split_pct: z.number().min(0).max(100),
  amount: z.number().min(0),
  created_at: z.string().datetime()
});

export type CommissionSplit = z.infer<typeof CommissionSplitSchema>;

// =====================================================
// TIPOS ADICIONALES
// =====================================================

export type Invoice = z.infer<typeof InvoiceSchema>;

/**
 * Resumen de comisiones
 */
export interface CommissionsSummary {
  total_pending: number;
  total_collected: number;
  total_void: number;
  count_pending: number;
  count_collected: number;
  count_void: number;
}

/**
 * Estado de cuenta del cliente
 */
export interface ClientStatement {
  policy_id: string;
  policy_number: string;
  insurer: string;
  line: string;
  invoices: Array<{
    id: string;
    amount: number;
    due_date: string;
    status: InvoiceStatus;
    paid_date: string | null;
    installment_number: number;
    total_installments: number;
  }>;
  total_amount: number;
  total_paid: number;
  total_pending: number;
}

/**
 * Estadísticas de facturación
 */
export interface BillingStats {
  total_invoices: number;
  total_pending: number;
  total_paid: number;
  total_overdue: number;
  amount_pending: number;
  amount_paid: number;
  amount_overdue: number;
}

// =====================================================
// HELPERS - UI
// =====================================================

/**
 * Labels para estados de cuota
 */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  overdue: 'Vencida',
  waived: 'Condonada'
};

/**
 * Colores para estados de cuota (Tailwind classes)
 */
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-300',
  paid: 'bg-green-100 text-green-800 border-green-300',
  overdue: 'bg-red-100 text-red-800 border-red-300',
  waived: 'bg-blue-100 text-blue-800 border-blue-300'
};

/**
 * Labels para frecuencias de pago
 */
export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual'
};

/**
 * Labels para estados de comisión
 */
export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'Pendiente',
  collected: 'Cobrada',
  void: 'Anulada'
};

/**
 * Colores para estados de comisión (Tailwind classes)
 */
export const COMMISSION_STATUS_COLORS: Record<CommissionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  collected: 'bg-green-100 text-green-800 border-green-300',
  void: 'bg-gray-100 text-gray-800 border-gray-300'
};

/**
 * Labels para líneas de seguro
 */
export const LINE_LABELS: Record<string, string> = {
  vida: 'Vida',
  auto: 'Auto',
  salud: 'Salud',
  hogar: 'Hogar',
  soat: 'SOAT',
  otro: 'Otro'
};

/**
 * Formatea monto con moneda
 */
export function formatCurrency(amount: number, currency: string = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
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
 * Formatea período (mes/año)
 */
export function formatPeriod(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long'
  });
}

/**
 * Calcula días hasta vencimiento
 */
export function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Verifica si una cuota está próxima a vencer (7 días)
 */
export function isDueSoon(dueDate: string): boolean {
  const days = getDaysUntilDue(dueDate);
  return days >= 0 && days <= 7;
}

/**
 * Obtiene el color de badge según días para vencer
 */
export function getDueDateColor(dueDate: string, status: InvoiceStatus): string {
  if (status === 'paid') return 'bg-green-100 text-green-800';
  if (status === 'waived') return 'bg-blue-100 text-blue-800';
  
  const days = getDaysUntilDue(dueDate);
  if (days < 0) return 'bg-red-100 text-red-800';
  if (days <= 7) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
}
