import { getBrowserClient } from '@/lib/supabase/client';
import type {
  BusinessGroup,
  CreateBusinessGroupInput,
  UpdateBusinessGroupInput,
} from '@/types/business-groups';

export async function getBusinessGroups(): Promise<BusinessGroup[]> {
  const supabase = getBrowserClient();
  const { data, error } = await (supabase
    .from('business_groups') as any)
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getBusinessGroupById(id: string): Promise<BusinessGroup | null> {
  const supabase = getBrowserClient();
  const { data, error } = await (supabase
    .from('business_groups') as any)
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createBusinessGroup(
  input: CreateBusinessGroupInput,
  tenantId: string
): Promise<BusinessGroup> {
  const supabase = getBrowserClient();

  const cleanInput: Record<string, unknown> = { tenant_id: tenantId };
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    cleanInput[key] = value === '' ? null : value;
  }

  const { data, error } = await (supabase
    .from('business_groups') as any)
    .insert(cleanInput)
    .select('*');

  if (error) throw error;
  const results = data as BusinessGroup[];
  return results[0];
}

export async function updateBusinessGroup(
  id: string,
  input: UpdateBusinessGroupInput
): Promise<BusinessGroup> {
  const supabase = getBrowserClient();

  const cleanInput: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    cleanInput[key] = value === '' ? null : value;
  }

  const { data, error } = await (supabase
    .from('business_groups') as any)
    .update(cleanInput)
    .eq('id', id)
    .select('*');

  if (error) throw error;
  const results = data as BusinessGroup[];
  if (!results || results.length === 0) throw new Error('No se encontró el grupo');
  return results[0];
}

export async function deleteBusinessGroup(id: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await (supabase
    .from('business_groups') as any)
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveBusinessGroups(): Promise<BusinessGroup[]> {
  const supabase = getBrowserClient();
  const { data, error } = await (supabase
    .from('business_groups') as any)
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}
