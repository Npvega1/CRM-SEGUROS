import { getBrowserClient } from '@/lib/supabase/client';
import type {
  CostCenter,
  CreateCostCenterInput,
  UpdateCostCenterInput,
} from '@/types/cost-centers';

export async function getCostCenters(): Promise<CostCenter[]> {
  const supabase = getBrowserClient();
  const { data, error } = await (supabase
    .from('cost_centers') as any)
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCostCenterById(id: string): Promise<CostCenter | null> {
  const supabase = getBrowserClient();
  const { data, error } = await (supabase
    .from('cost_centers') as any)
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCostCenter(
  input: CreateCostCenterInput,
  tenantId: string
): Promise<CostCenter> {
  const supabase = getBrowserClient();

  const cleanInput: Record<string, unknown> = { tenant_id: tenantId };
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    cleanInput[key] = value === '' ? null : value;
  }

  const { data, error } = await (supabase
    .from('cost_centers') as any)
    .insert(cleanInput)
    .select('*');

  if (error) throw error;
  const results = data as CostCenter[];
  return results[0];
}

export async function updateCostCenter(
  id: string,
  input: UpdateCostCenterInput
): Promise<CostCenter> {
  const supabase = getBrowserClient();

  const cleanInput: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    cleanInput[key] = value === '' ? null : value;
  }

  const { data, error } = await (supabase
    .from('cost_centers') as any)
    .update(cleanInput)
    .eq('id', id)
    .select('*');

  if (error) throw error;
  const results = data as CostCenter[];
  if (!results || results.length === 0) throw new Error('No se encontró el centro de costos');
  return results[0];
}

export async function deleteCostCenter(id: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await (supabase
    .from('cost_centers') as any)
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveCostCenters(): Promise<CostCenter[]> {
  const supabase = getBrowserClient();
  const { data, error } = await (supabase
    .from('cost_centers') as any)
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}
