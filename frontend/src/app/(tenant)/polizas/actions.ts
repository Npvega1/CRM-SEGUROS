'use server';

// =====================================================
// SERVER ACTIONS - Pólizas
// Módulo 01: Gestión de Pólizas
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  CreatePolicyInputSchema,
  UpdatePolicyInputSchema,
  UpdatePolicyStatusInputSchema,
  type UpdatePolicyInput,
  type Policy,
  type PolicyHistory,
  type ExpiringPolicy,
  isValidStatusTransition,
  type PolicyStatus
} from '@/lib/validations/policies';
import { type Result, ok, err, type AppError } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Tipo helper para manejar las tablas que aún no existen en la DB real
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

// =====================================================
// HELPER: Obtener tenant_id del usuario actual
// =====================================================
async function getTenantId(): Promise<string | null> {
  const supabase = await createClient() as AnySupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.app_metadata?.tenant_id || null;
}

// =====================================================
// CREATE POLICY
// =====================================================
export async function createPolicy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>
): Promise<Result<Policy, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    // Obtener tenant_id
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Validar input con Zod
    const validationResult = CreatePolicyInputSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return err({
        code: 'VALIDATION_ERROR',
        message: firstError?.message || 'Datos inválidos',
        details: { errors: validationResult.error.issues }
      });
    }

    const validatedData = validationResult.data;

    // Verificar que el cliente existe y pertenece al tenant
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', validatedData.client_id)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !clientData) {
      return err({ code: 'NOT_FOUND', message: 'Cliente no encontrado' });
    }

    // Insertar póliza
    const { data, error } = await supabase
      .from('policies')
      .insert({
        tenant_id: tenantId,
        client_id: validatedData.client_id,
        policy_number: validatedData.policy_number,
        insurer: validatedData.insurer,
        line: validatedData.line,
        status: validatedData.status,
        premium: validatedData.premium,
        currency: validatedData.currency,
        start_date: validatedData.start_date,
        end_date: validatedData.end_date,
        commission_pct: validatedData.commission_pct,
        metadata: validatedData.metadata
      })
      .select()
      .single();

    if (error) {
      // Manejar error de duplicado
      if (error.code === '23505') {
        return err({
          code: 'DUPLICATE_ERROR',
          message: 'Ya existe una póliza con este número'
        });
      }
      return err({ code: 'DB_ERROR', message: error.message });
    }

    revalidatePath('/polizas');
    revalidatePath(`/clientes/${validatedData.client_id}`);
    return ok(data as Policy);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// UPDATE POLICY
// =====================================================
export async function updatePolicy(
  id: string,
  input: UpdatePolicyInput
): Promise<Result<Policy, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    // Obtener tenant_id
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Validar input con Zod
    const validationResult = UpdatePolicyInputSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return err({
        code: 'VALIDATION_ERROR',
        message: firstError?.message || 'Datos inválidos',
        details: { errors: validationResult.error.issues }
      });
    }

    const validatedData = validationResult.data;

    // Actualizar póliza (sin cambiar status, usar updatePolicyStatus para eso)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...updateData } = validatedData;
    
    const { data, error } = await supabase
      .from('policies')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return err({
          code: 'DUPLICATE_ERROR',
          message: 'Ya existe una póliza con este número'
        });
      }
      return err({ code: 'DB_ERROR', message: error.message });
    }

    if (!data) {
      return err({ code: 'NOT_FOUND', message: 'Póliza no encontrada' });
    }

    revalidatePath('/polizas');
    revalidatePath(`/polizas/${id}`);
    return ok(data as Policy);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// UPDATE POLICY STATUS
// =====================================================
export async function updatePolicyStatus(
  policyId: string,
  newStatus: PolicyStatus,
  note?: string
): Promise<Result<Policy, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    // Obtener tenant_id
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Validar input
    const validationResult = UpdatePolicyStatusInputSchema.safeParse({
      policy_id: policyId,
      new_status: newStatus,
      note
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return err({
        code: 'VALIDATION_ERROR',
        message: firstError?.message || 'Datos inválidos'
      });
    }

    // Obtener estado actual de la póliza
    const { data: currentPolicy, error: fetchError } = await supabase
      .from('policies')
      .select('status')
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !currentPolicy) {
      return err({ code: 'NOT_FOUND', message: 'Póliza no encontrada' });
    }

    // Validar transición de estado (validación adicional en cliente)
    if (!isValidStatusTransition(currentPolicy.status as PolicyStatus, newStatus)) {
      return err({
        code: 'INVALID_TRANSITION',
        message: `No se puede cambiar de "${currentPolicy.status}" a "${newStatus}"`
      });
    }

    // Actualizar estado (el trigger insertará en policy_history automáticamente)
    const { data, error } = await supabase
      .from('policies')
      .update({ status: newStatus })
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      // El trigger de validación puede rechazar la transición
      if (error.message.includes('Transición de estado no válida')) {
        return err({
          code: 'INVALID_TRANSITION',
          message: error.message
        });
      }
      return err({ code: 'DB_ERROR', message: error.message });
    }

    // Si hay nota, actualizarla en el último registro del historial
    if (note) {
      await supabase
        .from('policy_history')
        .update({ note })
        .eq('policy_id', policyId)
        .eq('new_status', newStatus)
        .order('changed_at', { ascending: false })
        .limit(1);
    }

    revalidatePath('/polizas');
    revalidatePath(`/polizas/${policyId}`);
    return ok(data as Policy);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET POLICY BY ID
// =====================================================
export async function getPolicyById(id: string): Promise<Result<Policy & { client_name?: string }, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const { data, error } = await supabase
      .from('policies')
      .select(`
        *,
        clients (
          full_name
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return err({ code: 'DB_ERROR', message: error.message });
    }

    if (!data) {
      return err({ code: 'NOT_FOUND', message: 'Póliza no encontrada' });
    }

    // Formatear respuesta
    const policy = {
      ...data,
      client_name: (data.clients as { full_name: string } | null)?.full_name
    };
    delete (policy as Record<string, unknown>).clients;

    return ok(policy as Policy & { client_name?: string });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// LIST POLICIES (con paginación y filtros)
// =====================================================
export async function listPolicies(options?: {
  page?: number;
  pageSize?: number;
  clientId?: string;
  status?: string;
  line?: string;
  search?: string;
}): Promise<Result<{ policies: Array<Policy & { client_name?: string }>; total: number }, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Construir query
    let queryBuilder = supabase
      .from('policies')
      .select(`
        *,
        clients (
          full_name
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Aplicar filtros
    if (options?.clientId) {
      queryBuilder = queryBuilder.eq('client_id', options.clientId);
    }
    if (options?.status) {
      queryBuilder = queryBuilder.eq('status', options.status);
    }
    if (options?.line) {
      queryBuilder = queryBuilder.eq('line', options.line);
    }
    if (options?.search) {
      queryBuilder = queryBuilder.or(
        `policy_number.ilike.%${options.search}%,insurer.ilike.%${options.search}%`
      );
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      return err({ code: 'DB_ERROR', message: error.message });
    }

    // Formatear respuesta
    const policies = (data || []).map(row => ({
      ...row,
      client_name: (row.clients as { full_name: string } | null)?.full_name,
      clients: undefined
    }));

    return ok({
      policies: policies as Array<Policy & { client_name?: string }>,
      total: count || 0
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET POLICIES BY CLIENT
// =====================================================
export async function getPoliciesByClient(
  clientId: string
): Promise<Result<Policy[], AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      return err({ code: 'DB_ERROR', message: error.message });
    }

    return ok((data || []) as Policy[]);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET POLICY HISTORY
// =====================================================
export async function getPolicyHistory(
  policyId: string
): Promise<Result<PolicyHistory[], AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const { data, error } = await supabase
      .from('policy_history')
      .select(`
        *,
        users:changed_by (
          full_name
        )
      `)
      .eq('policy_id', policyId)
      .order('changed_at', { ascending: false });

    if (error) {
      return err({ code: 'DB_ERROR', message: error.message });
    }

    return ok((data || []) as PolicyHistory[]);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// UPLOAD POLICY DOCUMENT
// =====================================================
export async function uploadPolicyDocument(
  policyId: string,
  file: File
): Promise<Result<string, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Verificar que la póliza existe
    const { data: policyData, error: policyError } = await supabase
      .from('policies')
      .select('id')
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .single();

    if (policyError || !policyData) {
      return err({ code: 'NOT_FOUND', message: 'Póliza no encontrada' });
    }

    // Generar nombre único para el archivo
    const fileExt = file.name.split('.').pop();
    const fileName = `${tenantId}/${policyId}/${Date.now()}.${fileExt}`;

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Subir archivo a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('policy-documents')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      return err({ code: 'UPLOAD_ERROR', message: uploadError.message });
    }

    // Generar URL firmada (válida por 1 hora)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('policy-documents')
      .createSignedUrl(fileName, 3600); // 1 hora

    if (urlError) {
      return err({ code: 'URL_ERROR', message: urlError.message });
    }

    // Actualizar document_url en la póliza (guardar el path, no la URL firmada)
    const { error: updateError } = await supabase
      .from('policies')
      .update({ document_url: fileName })
      .eq('id', policyId);

    if (updateError) {
      return err({ code: 'DB_ERROR', message: updateError.message });
    }

    revalidatePath(`/polizas/${policyId}`);
    return ok(signedUrlData.signedUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET DOCUMENT SIGNED URL
// =====================================================
export async function getDocumentSignedUrl(
  policyId: string
): Promise<Result<string, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    // Obtener document_url de la póliza
    const { data: policyData, error: policyError } = await supabase
      .from('policies')
      .select('document_url')
      .eq('id', policyId)
      .single();

    if (policyError || !policyData) {
      return err({ code: 'NOT_FOUND', message: 'Póliza no encontrada' });
    }

    if (!policyData.document_url) {
      return err({ code: 'NOT_FOUND', message: 'No hay documento adjunto' });
    }

    // Generar URL firmada
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('policy-documents')
      .createSignedUrl(policyData.document_url, 3600);

    if (urlError) {
      return err({ code: 'URL_ERROR', message: urlError.message });
    }

    return ok(signedUrlData.signedUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET EXPIRING POLICIES (Alertas de vencimiento)
// =====================================================
export async function getExpiringPolicies(
  daysAhead: number[] = [5, 15, 30]
): Promise<Result<ExpiringPolicy[], AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Usar la función RPC
    const { data, error } = await supabase.rpc('get_expiring_policies', {
      p_tenant_id: tenantId,
      p_days_ahead: daysAhead
    });

    if (error) {
      // Fallback si la función no existe
      console.warn('get_expiring_policies RPC failed, using fallback:', error.message);
      
      const today = new Date();
      const dates = daysAhead.map(days => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      });

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('policies')
        .select(`
          id,
          policy_number,
          client_id,
          clients (full_name),
          insurer,
          line,
          premium,
          end_date
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'activa')
        .in('end_date', dates);

      if (fallbackError) {
        return err({ code: 'DB_ERROR', message: fallbackError.message });
      }

      const policies = (fallbackData || []).map(row => {
        const endDate = new Date(row.end_date as string);
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clientData = row.clients as any;
        return {
          id: row.id,
          policy_number: row.policy_number,
          client_id: row.client_id,
          client_name: clientData?.full_name || '',
          insurer: row.insurer,
          line: row.line,
          premium: row.premium,
          end_date: row.end_date,
          days_until_expiry: diffDays
        };
      });

      return ok(policies as ExpiringPolicy[]);
    }

    return ok((data || []) as ExpiringPolicy[]);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET POLICY STATS
// =====================================================
export async function getPolicyStats(): Promise<Result<{
  total: number;
  active: number;
  byStatus: Record<string, number>;
  byLine: Record<string, number>;
  totalPremium: number;
  expiringThisMonth: number;
}, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Total de pólizas
    const { count: total } = await supabase
      .from('policies')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Pólizas activas
    const { count: active } = await supabase
      .from('policies')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'activa');

    // Por estado y línea
    const { data: allPolicies } = await supabase
      .from('policies')
      .select('status, line, premium, end_date')
      .eq('tenant_id', tenantId);

    const byStatus: Record<string, number> = {
      cotizacion: 0,
      activa: 0,
      vencida: 0,
      cancelada: 0,
      renovacion: 0
    };

    const byLine: Record<string, number> = {
      vida: 0,
      auto: 0,
      salud: 0,
      hogar: 0,
      soat: 0,
      otro: 0
    };

    let totalPremium = 0;
    let expiringThisMonth = 0;

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);

    allPolicies?.forEach(policy => {
      if (policy.status && byStatus[policy.status] !== undefined) {
        byStatus[policy.status]++;
      }
      if (policy.line && byLine[policy.line] !== undefined) {
        byLine[policy.line]++;
      }
      if (policy.status === 'activa' && policy.premium) {
        totalPremium += Number(policy.premium);
      }
      if (policy.end_date && new Date(policy.end_date) <= endOfMonth) {
        expiringThisMonth++;
      }
    });

    return ok({
      total: total || 0,
      active: active || 0,
      byStatus,
      byLine,
      totalPremium,
      expiringThisMonth
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}
