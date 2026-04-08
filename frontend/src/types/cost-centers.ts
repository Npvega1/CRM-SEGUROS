import { z } from 'zod';

export const costCenterSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  code: z.string().min(1, 'El código es requerido'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const createCostCenterSchema = costCenterSchema.omit({
  id: true,
  tenant_id: true,
  created_at: true,
  updated_at: true,
});

export const updateCostCenterSchema = costCenterSchema.partial().omit({
  id: true,
  tenant_id: true,
  created_at: true,
  updated_at: true,
});

export type CostCenter = z.infer<typeof costCenterSchema>;
export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;
