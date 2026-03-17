'use server';

// =====================================================
// SERVER ACTIONS - Clientes (OPTIMIZADO)
// Módulo 01: Gestión de Clientes
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  CreateClientInputSchema,
  UpdateClientInputSchema,
  type Client,
  type CSVRowError,
  type CSVImportResult
} from '@/lib/validations/clients';
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
// CREATE CLIENT
// =====================================================
export async function createClient_action(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>
): Promise<Result<Client, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    // Obtener tenant_id
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Validar input con Zod
    const validationResult = CreateClientInputSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return err({
        code: 'VALIDATION_ERROR',
        message: firstError?.message || 'Datos inválidos',
        details: { errors: validationResult.error.issues }
      });
    }

    const validatedData = validationResult.data;

    // Insertar cliente
    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        full_name: validatedData.full_name,
        doc_type: validatedData.doc_type,
        doc_number: validatedData.doc_number,
        email: validatedData.email,
        phone: validatedData.phone,
        segment: validatedData.segment,
        agent_id: validatedData.agent_id,
        tags: validatedData.tags,
        metadata: validatedData.metadata
      })
      .select()
      .single();

    if (error) {
      // Manejar error de duplicado
      if (error.code === '23505') {
        return err({
          code: 'DUPLICATE_ERROR',
          message: 'Ya existe un cliente con este número de documento'
        });
      }
      return err({ code: 'DB_ERROR', message: error.message });
    }

    revalidatePath('/clientes');
    return ok(data as Client);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// UPDATE CLIENT
// =====================================================
export async function updateClient(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>
): Promise<Result<Client, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    // Obtener tenant_id
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Validar input con Zod
    const validationResult = UpdateClientInputSchema.safeParse(input);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return err({
        code: 'VALIDATION_ERROR',
        message: firstError?.message || 'Datos inválidos',
        details: { errors: validationResult.error.issues }
      });
    }

    const validatedData = validationResult.data;

    // Actualizar cliente
    const { data, error } = await supabase
      .from('clients')
      .update(validatedData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return err({
          code: 'DUPLICATE_ERROR',
          message: 'Ya existe un cliente con este número de documento'
        });
      }
      return err({ code: 'DB_ERROR', message: error.message });
    }

    if (!data) {
      return err({ code: 'NOT_FOUND', message: 'Cliente no encontrado' });
    }

    revalidatePath('/clientes');
    revalidatePath(`/clientes/${id}`);
    return ok(data as Client);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// DELETE CLIENT (Soft Delete)
// =====================================================
export async function deleteClient(id: string): Promise<Result<boolean, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    // Obtener tenant_id
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    // Soft delete: marcar como inactivo
    const { error } = await supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      return err({ code: 'DB_ERROR', message: error.message });
    }

    revalidatePath('/clientes');
    return ok(true);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET CLIENT BY ID
// =====================================================
export async function getClientById(id: string): Promise<Result<Client, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return err({ code: 'NOT_FOUND', message: 'Cliente no encontrado' });
    }

    return ok(data as Client);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// SEARCH CLIENTS (Full-text con pg_trgm)
// =====================================================
export async function searchClients(
  query: string,
  options?: {
    segment?: string;
    agentId?: string;
    limit?: number;
  }
): Promise<Result<Client[], AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    const limit = options?.limit || 50;

    // Usar la función de búsqueda con pg_trgm
    const { data, error } = await supabase.rpc('search_clients', {
      p_tenant_id: tenantId,
      p_query: query,
      p_limit: limit
    });

    if (error) {
      // Fallback a búsqueda simple si la función no existe
      console.warn('search_clients RPC failed, using fallback:', error.message);
      
      let queryBuilder = supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`full_name.ilike.%${query}%,doc_number.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(limit);

      if (options?.segment) {
        queryBuilder = queryBuilder.eq('segment', options.segment);
      }
      if (options?.agentId) {
        queryBuilder = queryBuilder.eq('agent_id', options.agentId);
      }

      const { data: fallbackData, error: fallbackError } = await queryBuilder;
      
      if (fallbackError) {
        return err({ code: 'DB_ERROR', message: fallbackError.message });
      }
      
      return ok((fallbackData || []) as Client[]);
    }

    return ok((data || []) as Client[]);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// LIST CLIENTS (con paginación y filtros) - OPTIMIZADO
// =====================================================
export async function listClients(options?: {
  page?: number;
  pageSize?: number;
  segment?: string;
  agentId?: string;
  search?: string;
}): Promise<Result<{ clients: Client[]; total: number }, AppError>> {
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

    // Construir query base
    let queryBuilder = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Aplicar filtros
    if (options?.segment) {
      queryBuilder = queryBuilder.eq('segment', options.segment);
    }
    if (options?.agentId) {
      queryBuilder = queryBuilder.eq('agent_id', options.agentId);
    }
    if (options?.search) {
      queryBuilder = queryBuilder.or(
        `full_name.ilike.%${options.search}%,doc_number.ilike.%${options.search}%,email.ilike.%${options.search}%`
      );
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      return err({ code: 'DB_ERROR', message: error.message });
    }

    return ok({
      clients: (data || []) as Client[],
      total: count || 0
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// IMPORT CLIENTS FROM CSV
// =====================================================
export async function importClientsFromCSV(
  rows: Array<{
    full_name: string;
    doc_type?: string;
    doc_number: string;
    email?: string;
    phone?: string;
    segment?: string;
    tags?: string;
  }>
): Promise<Result<CSVImportResult, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    const errors: CSVRowError[] = [];
    let successCount = 0;
    const BATCH_SIZE = 100;

    // Procesar en lotes
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const validRows: Array<{
        tenant_id: string;
        full_name: string;
        doc_type: string;
        doc_number: string;
        email: string | null;
        phone: string | null;
        segment: string;
        tags: string[];
      }> = [];

      // Validar cada fila del lote
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowIndex = i + j + 2; // +2 porque empezamos en 1 y hay header

        // Validar campos requeridos
        if (!row.full_name?.trim()) {
          errors.push({
            row: rowIndex,
            field: 'full_name',
            message: 'El nombre es requerido'
          });
          continue;
        }

        if (!row.doc_number?.trim()) {
          errors.push({
            row: rowIndex,
            field: 'doc_number',
            message: 'El documento es requerido'
          });
          continue;
        }

        // Validar tipo de documento
        const validDocTypes = ['rut', 'nit', 'cedula', 'pasaporte'];
        const docType = (row.doc_type?.toLowerCase() || 'cedula');
        if (!validDocTypes.includes(docType)) {
          errors.push({
            row: rowIndex,
            field: 'doc_type',
            message: `Tipo de documento inválido. Debe ser uno de: ${validDocTypes.join(', ')}`,
            value: row.doc_type
          });
          continue;
        }

        // Validar segmento
        const validSegments = ['individual', 'empresa', 'vip'];
        const segment = (row.segment?.toLowerCase() || 'individual');
        if (!validSegments.includes(segment)) {
          errors.push({
            row: rowIndex,
            field: 'segment',
            message: `Segmento inválido. Debe ser uno de: ${validSegments.join(', ')}`,
            value: row.segment
          });
          continue;
        }

        // Parsear tags si existen
        let tags: string[] = [];
        if (row.tags) {
          tags = row.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }

        validRows.push({
          tenant_id: tenantId,
          full_name: row.full_name.trim(),
          doc_type: docType,
          doc_number: row.doc_number.toUpperCase().trim(),
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          segment: segment,
          tags
        });
      }

      // Insertar lote válido
      if (validRows.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('clients')
          .insert(validRows)
          .select();

        if (insertError) {
          // Si es error de duplicado, intentar insertar uno por uno
          if (insertError.code === '23505') {
            for (const row of validRows) {
              const { error: singleError } = await supabase
                .from('clients')
                .insert(row)
                .select();

              if (singleError) {
                const rowIndex = rows.findIndex(
                  r => r.doc_number?.toUpperCase() === row.doc_number
                ) + 2;
                errors.push({
                  row: rowIndex,
                  field: 'doc_number',
                  message: 'Ya existe un cliente con este documento',
                  value: row.doc_number
                });
              } else {
                successCount++;
              }
            }
          } else {
            // Error general del lote
            for (const row of validRows) {
              const rowIndex = rows.findIndex(
                r => r.doc_number?.toUpperCase() === row.doc_number
              ) + 2;
              errors.push({
                row: rowIndex,
                field: 'general',
                message: insertError.message
              });
            }
          }
        } else {
          successCount += insertedData?.length || validRows.length;
        }
      }
    }

    revalidatePath('/clientes');
    
    return ok({
      success: successCount,
      failed: errors.length,
      errors
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}

// =====================================================
// GET CLIENT STATS (OPTIMIZADO - Single Query)
// =====================================================
export async function getClientStats(): Promise<Result<{
  total: number;
  bySegment: Record<string, number>;
  thisMonth: number;
}, AppError>> {
  try {
    const supabase = await createClient() as AnySupabaseClient;
    
    const tenantId = await getTenantId();
    if (!tenantId) {
      return err({ code: 'UNAUTHORIZED', message: 'No tienes acceso a esta organización' });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // OPTIMIZACIÓN: Una sola query trayendo solo lo necesario
    const { data, error } = await supabase
      .from('clients')
      .select('segment, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      return err({ code: 'DB_ERROR', message: error.message });
    }

    const clients = data || [];
    const total = clients.length;

    // Calcular stats en memoria (más rápido que múltiples queries)
    const bySegment: Record<string, number> = {
      individual: 0,
      empresa: 0,
      vip: 0
    };

    let thisMonth = 0;
    const startOfMonthTime = startOfMonth.getTime();

    clients.forEach(client => {
      // Contar por segmento
      if (client.segment && bySegment[client.segment] !== undefined) {
        bySegment[client.segment]++;
      }

      // Contar este mes
      if (client.created_at) {
        const createdDate = new Date(client.created_at);
        if (createdDate.getTime() >= startOfMonthTime) {
          thisMonth++;
        }
      }
    });

    return ok({
      total,
      bySegment,
      thisMonth
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return err({ code: 'UNKNOWN_ERROR', message });
  }
}
