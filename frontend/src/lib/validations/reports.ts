// =====================================================
// VALIDACIONES Y TIPOS - Módulo 04: Reportes
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// SCHEMAS ZOD PARA FILTROS
// =====================================================

export const ReportFiltersSchema = z.object({
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  agentId: z.string().uuid().optional().nullable(),
  agentIds: z.array(z.string().uuid()).optional(),
  line: z.enum(['vida', 'auto', 'salud', 'hogar', 'soat', 'otro']).optional().nullable(),
  insurer: z.string().optional().nullable(),
  days: z.number().int().positive().optional(),
});

export type ReportFilters = z.infer<typeof ReportFiltersSchema>;

// =====================================================
// SCHEMAS ZOD PARA DATOS DE REPORTES
// =====================================================

export const ExecutiveDashboardDataSchema = z.object({
  active_policies_count: z.number(),
  total_premium_month: z.number(),
  open_claims_count: z.number(),
  renewals_next_30_days: z.number(),
  pending_commissions_total: z.number(),
  active_policies_prev: z.number(),
  total_premium_prev: z.number(),
  open_claims_prev: z.number(),
});

export type ExecutiveDashboardData = z.infer<typeof ExecutiveDashboardDataSchema>;

export const AgentPerformanceDataSchema = z.object({
  agent_id: z.string().uuid(),
  agent_name: z.string(),
  policies_created_month: z.number(),
  total_premium: z.number(),
  pipeline_total: z.number(),
  pipeline_won_month: z.number(),
  close_rate: z.number(),
  commissions_earned_month: z.number(),
});

export type AgentPerformanceData = z.infer<typeof AgentPerformanceDataSchema>;

export const PortfolioByLineSchema = z.object({
  line: z.string(),
  count: z.number(),
  premium: z.number(),
  percentage: z.number(),
});

export type PortfolioByLine = z.infer<typeof PortfolioByLineSchema>;

export const PortfolioByInsurerSchema = z.object({
  insurer: z.string(),
  count: z.number(),
  premium: z.number(),
  percentage: z.number(),
});

export type PortfolioByInsurer = z.infer<typeof PortfolioByInsurerSchema>;

export const PremiumTrendSchema = z.object({
  month: z.string(),
  month_date: z.string(),
  premium: z.number(),
  policies_count: z.number(),
});

export type PremiumTrend = z.infer<typeof PremiumTrendSchema>;

export const ClaimsAnalyticsSchema = z.object({
  total_claims: z.number(),
  open_claims: z.number(),
  resolved_claims: z.number(),
  avg_claimed_amount: z.number(),
  avg_approved_amount: z.number(),
  total_claimed: z.number(),
  total_approved: z.number(),
  loss_ratio: z.number(),
  claims_by_status: z.array(z.object({
    status: z.string(),
    count: z.number(),
  })),
  claims_by_line: z.array(z.object({
    line: z.string(),
    count: z.number(),
    amount: z.number(),
  })),
});

export type ClaimsAnalytics = z.infer<typeof ClaimsAnalyticsSchema>;

export const RenewalStatusEnum = z.enum(['sin_gestion', 'en_contacto', 'renovado']);
export type RenewalStatus = z.infer<typeof RenewalStatusEnum>;

export const RenewalReportItemSchema = z.object({
  policy_id: z.string().uuid(),
  policy_number: z.string(),
  client_id: z.string().uuid(),
  client_name: z.string(),
  client_email: z.string().nullable(),
  client_phone: z.string().nullable(),
  insurer: z.string(),
  line: z.string(),
  premium: z.number(),
  commission: z.number(),
  end_date: z.string(),
  days_remaining: z.number(),
  renewal_status: RenewalStatusEnum,
});

export type RenewalReportItem = z.infer<typeof RenewalReportItemSchema>;

export const CommissionReportItemSchema = z.object({
  policy_id: z.string().uuid(),
  policy_number: z.string(),
  client_name: z.string(),
  insurer: z.string(),
  line: z.string(),
  premium: z.number(),
  commission_pct: z.number(),
  commission_amount: z.number(),
  policy_status: z.string(),
  created_at: z.string(),
  agent_id: z.string().uuid().nullable(),
  agent_name: z.string().nullable(),
});

export type CommissionReportItem = z.infer<typeof CommissionReportItemSchema>;

// =====================================================
// TIPOS PARA COMPONENTES UI
// =====================================================

export interface KPICardData {
  title: string;
  value: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percentage';
  icon?: React.ElementType;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  sparklineData?: number[];
}

export interface ChartDataPoint {
  name: string;
  value: number;
  percentage?: number;
  fill?: string;
}

// =====================================================
// CONSTANTES
// =====================================================

export const LINE_LABELS: Record<string, string> = {
  vida: 'Vida',
  auto: 'Auto',
  salud: 'Salud',
  hogar: 'Hogar',
  soat: 'SOAT',
  otro: 'Otro',
};

export const STATUS_LABELS: Record<string, string> = {
  reported: 'Reportado',
  investigating: 'En Investigación',
  docs_complete: 'Documentación Completa',
  processing: 'En Proceso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  sin_gestion: 'Sin Gestión',
  en_contacto: 'En Contacto',
  renovado: 'Renovado',
};

export const RENEWAL_STATUS_COLORS: Record<RenewalStatus, string> = {
  sin_gestion: 'bg-red-100 text-red-800',
  en_contacto: 'bg-yellow-100 text-yellow-800',
  renovado: 'bg-green-100 text-green-800',
};

export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#eab308', // yellow-500
];
