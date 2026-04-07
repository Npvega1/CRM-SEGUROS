import { z } from 'zod';

export const businessGroupSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  main_nit: z.string().min(5, 'El NIT debe tener al menos 5 caracteres'),
  primary_contact_name: z.string().optional().nullable(),
  primary_contact_phone: z.string().optional().nullable(),
  secondary_contact_name: z.string().optional().nullable(),
  secondary_contact_phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const createBusinessGroupSchema = businessGroupSchema.omit({
  id: true,
  tenant_id: true,
  created_at: true,
  updated_at: true,
});

export const updateBusinessGroupSchema = businessGroupSchema.partial().omit({
  id: true,
  tenant_id: true,
  created_at: true,
  updated_at: true,
});

export type BusinessGroup = z.infer<typeof businessGroupSchema>;
export type CreateBusinessGroupInput = z.infer<typeof createBusinessGroupSchema>;
export type UpdateBusinessGroupInput = z.infer<typeof updateBusinessGroupSchema>;
