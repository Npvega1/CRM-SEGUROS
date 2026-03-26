import { z } from 'zod';

// ZOD SCHEMAS
export const alliedAgentSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  identification: z.string().min(5, 'La identificación debe tener al menos 5 caracteres'),
  phone: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres'),
  email: z.string().email('Correo electrónico inválido'),
  address: z.string().optional().nullable(),
  commission_percentage: z.number().min(0).max(100).default(60),
  document_cedula: z.string().optional().nullable(),
  document_bank_certificate: z.string().optional().nullable(),
  document_rut: z.string().optional().nullable(),
  document_other: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  auth_user_id: z.string().uuid().optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const createAlliedAgentSchema = alliedAgentSchema.omit({
  id: true,
  tenant_id: true,
  created_at: true,
  updated_at: true,
});

export const updateAlliedAgentSchema = alliedAgentSchema.partial().omit({
  id: true,
  tenant_id: true,
  auth_user_id: true,
  created_at: true,
  updated_at: true,
});

// TYPESCRIPT TYPES
export type AlliedAgent = z.infer<typeof alliedAgentSchema>;
export type CreateAlliedAgentInput = z.infer<typeof createAlliedAgentSchema>;
export type UpdateAlliedAgentInput = z.infer<typeof updateAlliedAgentSchema>;

export interface AlliedAgentWithStats extends AlliedAgent {
  total_clients?: number;
  total_policies?: number;
  total_premium?: number;
  pending_commissions?: number;
  paid_commissions?: number;
}

export interface AlliedAgentCommission {
  id: string;
  tenant_id: string;
  allied_agent_id: string;
  policy_id: string;
  policy_premium: number;
  policy_commission_percentage: number;
  agent_commission_percentage: number;
  commission_amount: number;
  status: 'pending' | 'paid';
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AlliedAgentCommissionWithPolicy extends AlliedAgentCommission {
  allied_agent?: { id: string; full_name: string };
  policy?: {
    id: string;
    policy_number: string;
    premium: number;
    client?: { id: string; full_name: string };
    insurance_company?: { id: string; name: string };
    insurance_line?: { id: string; name: string };
  };
}

export interface AlliedAgentPolicy {
  id: string;
  policy_number: string;
  premium: number;
  status: string;
  start_date: string;
  end_date: string;
  document_url?: string;
  client?: { id: string; full_name: string };
  insurance_company?: { id: string; name: string };
  insurance_line?: { id: string; name: string };
  commission?: {
    id: string;
    commission_amount: number;
    status: string;
    paid_at?: string;
  };
}

export interface AlliedAgentStats {
  total_clients: number;
  total_policies: number;
  total_premium: number;
  pending_commissions: number;
  paid_commissions: number;
}

export interface AlliedAgentReport {
  allied_agent_id: string;
  allied_agent_name: string;
  commission_percentage: number;
  total_clients: number;
  total_policies: number;
  total_premium: number;
  pending_commissions: number;
  paid_commissions: number;
  total_commissions: number;
}

export type DocumentType = 'cedula' | 'bank_certificate' | 'rut' | 'other';

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'cedula', label: 'Cédula' },
  { value: 'bank_certificate', label: 'Certificación Bancaria' },
  { value: 'rut', label: 'RUT' },
  { value: 'other', label: 'Otro' },
];
