// =====================================================
// SERVICIO: AI Comparison Service
// Módulo 09: Procesamiento de comparativos con IA
// Usa getBrowserClient() - NO Server Actions
// =====================================================

import { getBrowserClient } from '@/lib/supabase/client';
import type { PolicyLine } from '@/lib/validations/policies';
import type { 
  ComparisonWithRelations,
  ComparisonFile,
  ComparisonTable,
  UsageStats,
  ComparisonCriteria
} from '@/lib/validations/comparisons';
import { DEFAULT_MONTHLY_LIMIT, DEFAULT_COMPARISON_CRITERIA } from '@/lib/validations/comparisons';

// =====================================================
// TIPOS INTERNOS
// =====================================================

interface FileUploadData {
  name: string;
  type: string;
  size: number;
  base64: string;
}

interface CreateComparisonParams {
  tenantId: string;
  clientId?: string;  // Ahora opcional
  prospectName?: string;  // Nuevo: nombre del prospecto
  agentId: string;
  line: PolicyLine;
  files: FileUploadData[];
}

// =====================================================
// FUNCIONES DE UTILIDAD
// =====================================================

/**
 * Obtiene el uso mensual de comparativos
 */
export async function getMonthlyUsage(tenantId: string): Promise<UsageStats> {
  const supabase = getBrowserClient();
  
  // Obtener fecha inicio del mes
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('usage_logs')
    .select('usage_count')
    .eq('tenant_id', tenantId)
    .eq('feature', 'comparisons')
    .gte('count_date', startOfMonth.toISOString().split('T')[0])
    .lte('count_date', endOfMonth.toISOString().split('T')[0]);
  
  if (error) {
    console.error('Error getting monthly usage:', error);
    return { used: 0, limit: DEFAULT_MONTHLY_LIMIT, remaining: DEFAULT_MONTHLY_LIMIT, percentage: 0 };
  }
  
  const used = (data as Array<{ usage_count: number }>)?.reduce((sum, row) => sum + row.usage_count, 0) || 0;
  const limit = DEFAULT_MONTHLY_LIMIT;
  const remaining = Math.max(0, limit - used);
  const percentage = Math.min(100, (used / limit) * 100);
  
  return { used, limit, remaining, percentage };
}

/**
 * Verifica si se puede crear un nuevo comparativo
 */
export async function canCreateComparison(tenantId: string): Promise<{ allowed: boolean; message?: string }> {
  const usage = await getMonthlyUsage(tenantId);
  
  if (usage.remaining <= 0) {
    return { 
      allowed: false, 
      message: `Has alcanzado el límite de ${usage.limit} comparativos mensuales. El límite se reinicia el próximo mes.` 
    };
  }
  
  return { allowed: true };
}

/**
 * Incrementa el uso de comparativos
 */
async function incrementUsage(tenantId: string): Promise<void> {
  const supabase = getBrowserClient();
  const today = new Date().toISOString().split('T')[0];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from('usage_logs')
    .insert({
      tenant_id: tenantId,
      feature: 'comparisons',
      count_date: today,
      usage_count: 1
    });
  
  // Si ya existe, actualizar manualmente
  if (insertError && insertError.code === '23505') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('usage_logs')
      .select('usage_count')
      .eq('tenant_id', tenantId)
      .eq('feature', 'comparisons')
      .eq('count_date', today)
      .single();
    
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('usage_logs')
        .update({ usage_count: (existing.usage_count || 0) + 1 })
        .eq('tenant_id', tenantId)
        .eq('feature', 'comparisons')
        .eq('count_date', today);
    }
  }
}

// =====================================================
// FUNCIONES DE COMPARATIVOS
// =====================================================

/**
 * Obtiene todos los comparativos del tenant
 */
export async function getComparisons(tenantId: string): Promise<ComparisonWithRelations[]> {
  const supabase = getBrowserClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('comparisons')
    .select(`
      *,
      clients(id, full_name, email),
      users(id, full_name)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error getting comparisons:', error);
    return [];
  }
  
  return (data || []).map((item: Record<string, unknown>) => ({
    ...item,
    client: item.clients,
    agent: item.users
  })) as ComparisonWithRelations[];
}

/**
 * Obtiene un comparativo por ID
 */
export async function getComparisonById(comparisonId: string): Promise<ComparisonWithRelations | null> {
  const supabase = getBrowserClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('comparisons')
    .select(`
      *,
      clients(id, full_name, email),
      users(id, full_name)
    `)
    .eq('id', comparisonId)
    .single();
  
  if (error || !data) {
    console.error('Error getting comparison:', error);
    return null;
  }
  
  // Obtener archivos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: files } = await (supabase as any)
    .from('comparison_files')
    .select('*')
    .eq('comparison_id', comparisonId);
  
  const comparisonData = data as Record<string, unknown>;
  
  return {
    ...comparisonData,
    client: comparisonData.clients,
    agent: comparisonData.users,
    files: (files || []) as ComparisonFile[]
  } as ComparisonWithRelations;
}

/**
 * Obtiene el estado de un comparativo
 */
export async function getComparisonStatus(comparisonId: string): Promise<{
  status: string;
  comparison?: ComparisonWithRelations;
  error?: string;
}> {
  const comparison = await getComparisonById(comparisonId);
  
  if (!comparison) {
    return { status: 'error', error: 'Comparativo no encontrado' };
  }
  
  return { 
    status: comparison.status,
    comparison: comparison.status === 'ready' ? comparison : undefined,
    error: comparison.error_message || undefined
  };
}

/**
 * Crea un nuevo comparativo
 */
export async function createComparison(params: CreateComparisonParams): Promise<{
  success: boolean;
  comparisonId?: string;
  error?: string;
}> {
  const { tenantId, clientId, prospectName, agentId, line, files } = params;
  const supabase = getBrowserClient();
  
  // Validar que tenga cliente o prospecto
  if (!clientId && !prospectName) {
    return { success: false, error: 'Debe seleccionar un cliente o ingresar nombre de prospecto' };
  }
  
  // Verificar límite
  const canCreate = await canCreateComparison(tenantId);
  if (!canCreate.allowed) {
    return { success: false, error: canCreate.message };
  }
  
  try {
    // Crear comparativo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertData: Record<string, unknown> = {
      tenant_id: tenantId,
      agent_id: agentId,
      line,
      status: 'processing',
      source_files: files.map(f => f.name)
    };
    
    // Agregar cliente o prospecto
    if (clientId) {
      insertData.client_id = clientId;
    } else {
      insertData.prospect_name = prospectName;
    }
    
    const { data: comparison, error: compError } = await (supabase as any)
      .from('comparisons')
      .insert(insertData)
      .select()
      .single();
    
    if (compError || !comparison) {
      throw new Error(compError?.message || 'Error al crear comparativo');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comparisonData = comparison as any;
    
    // Subir archivos a Storage y crear registros
    const uploadedFiles: ComparisonFile[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const filePath = `${tenantId}/comparisons/${comparisonData.id}/${Date.now()}_${file.name}`;
      
      // Decodificar base64 y subir
      const base64Data = file.base64.split(',')[1] || file.base64;
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const { error: uploadError } = await supabase.storage
        .from('comparison-documents')
        .upload(filePath, binaryData, {
          contentType: file.type,
          upsert: true
        });
      
      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        // Continuar con otros archivos
      }
      
      // Crear registro de archivo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fileRecord, error: fileError } = await (supabase as any)
        .from('comparison_files')
        .insert({
          comparison_id: comparisonData.id,
          tenant_id: tenantId,
          original_name: file.name,
          file_url: filePath,
          file_type: fileExt as 'pdf' | 'docx',
          extraction_status: 'pending'
        })
        .select()
        .single();
      
      if (!fileError && fileRecord) {
        uploadedFiles.push(fileRecord as ComparisonFile);
      }
    }
    
    // Incrementar uso
    await incrementUsage(tenantId);
    
    return { success: true, comparisonId: comparisonData.id };
    
  } catch (error) {
    console.error('Error creating comparison:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Procesa un comparativo con IA (llamar desde el cliente)
 */
export async function processComparisonWithAI(
  comparisonId: string,
  tenantId: string,
  apiUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/api/ai/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comparisonId, tenantId })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Error al procesar' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error processing comparison:', error);
    return { success: false, error: 'Error de conexión con el servidor' };
  }
}

/**
 * Actualiza una celda del comparativo
 */
export async function updateComparisonCell(
  comparisonId: string,
  insurerKey: string,
  criteriaKey: string,
  newValue: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserClient();
  
  try {
    // Obtener comparativo actual
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comparison, error: getError } = await (supabase as any)
      .from('comparisons')
      .select('comparison_table')
      .eq('id', comparisonId)
      .single();
    
    if (getError || !comparison) {
      return { success: false, error: 'Comparativo no encontrado' };
    }
    
    const compData = comparison as { comparison_table: ComparisonTable | null };
    const table = compData.comparison_table;
    if (!table) {
      return { success: false, error: 'Tabla de comparación no disponible' };
    }
    
    // Actualizar valor
    const insurerIndex = table.insurers.findIndex(i => i.name === insurerKey);
    if (insurerIndex === -1) {
      return { success: false, error: 'Aseguradora no encontrada' };
    }
    
    if (!table.insurers[insurerIndex].fields[criteriaKey]) {
      table.insurers[insurerIndex].fields[criteriaKey] = { value: newValue };
    } else {
      table.insurers[insurerIndex].fields[criteriaKey].value = newValue;
    }
    
    // Guardar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('comparisons')
      .update({ comparison_table: table })
      .eq('id', comparisonId);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating cell:', error);
    return { success: false, error: 'Error al actualizar celda' };
  }
}

/**
 * Actualiza la recomendación del comparativo
 */
export async function updateRecommendation(
  comparisonId: string,
  recommendation: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('comparisons')
    .update({ ai_recommendation: recommendation })
    .eq('id', comparisonId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Obtiene los criterios de comparación para un ramo
 */
export async function getComparisonCriteria(
  tenantId: string, 
  line: PolicyLine
): Promise<ComparisonCriteria[]> {
  const supabase = getBrowserClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('comparison_criteria')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('line', line)
    .eq('is_active', true)
    .order('order_index');
  
  if (error || !data || data.length === 0) {
    // Retornar criterios por defecto
    return DEFAULT_COMPARISON_CRITERIA[line].map((name, index) => ({
      id: `default-${index}`,
      tenant_id: tenantId,
      line,
      criteria_name: name,
      order_index: index,
      is_active: true
    }));
  }
  
  return data as ComparisonCriteria[];
}

/**
 * Marca un comparativo como exportado
 */
export async function markAsExported(
  comparisonId: string,
  type: 'pdf' | 'xlsx',
  url: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserClient();
  
  const updateData: Record<string, string> = {
    status: 'exported'
  };
  
  if (type === 'pdf') {
    updateData.pdf_url = url;
  } else {
    updateData.xlsx_url = url;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('comparisons')
    .update(updateData)
    .eq('id', comparisonId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Elimina un comparativo
 */
export async function deleteComparison(comparisonId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getBrowserClient();
  
  // Primero eliminar archivos de storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: files } = await (supabase as any)
    .from('comparison_files')
    .select('file_url')
    .eq('comparison_id', comparisonId);
  
  if (files && files.length > 0) {
    const filePaths = (files as Array<{ file_url: string }>).map(f => f.file_url);
    await supabase.storage
      .from('comparison-documents')
      .remove(filePaths);
  }
  
  // Eliminar registros de archivos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('comparison_files')
    .delete()
    .eq('comparison_id', comparisonId);
  
  // Eliminar comparativo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('comparisons')
    .delete()
    .eq('id', comparisonId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}
