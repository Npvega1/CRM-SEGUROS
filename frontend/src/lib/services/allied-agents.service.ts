import { getBrowserClient } from '@/lib/supabase/client';
import type {
  AlliedAgent,
  CreateAlliedAgentInput,
  UpdateAlliedAgentInput,
  AlliedAgentCommission,
  AlliedAgentCommissionWithPolicy,
  AlliedAgentPolicy,
  AlliedAgentStats,
  AlliedAgentReport,
  DocumentType,
} from '@/types/allied-agents';

// CRUD DE AGENTES ALIADOS

export async function getAlliedAgents(): Promise<AlliedAgent[]> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAlliedAgentById(id: string): Promise<AlliedAgent | null> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getAlliedAgentByAuthUserId(authUserId: string): Promise<AlliedAgent | null> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agents')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createAlliedAgent(
  input: CreateAlliedAgentInput,
  tenantId: string
): Promise<AlliedAgent> {
  const supabase = getBrowserClient();
  const { password, ...agentData } = input;
  
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agents')
    .insert({
      ...agentData,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AlliedAgent;
}

export async function updateAlliedAgent(
  id: string,
  input: UpdateAlliedAgentInput
): Promise<AlliedAgent> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agents')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AlliedAgent;
}

export async function deleteAlliedAgent(id: string): Promise<void> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { error } = await supabase
    .from('allied_agents')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveAlliedAgents(): Promise<AlliedAgent[]> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agents')
    .select('*')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

// DOCUMENTOS

export async function uploadAlliedAgentDocument(
  alliedAgentId: string,
  tenantId: string,
  documentType: DocumentType,
  file: File
): Promise<string> {
  const supabase = getBrowserClient();
  const fileExt = file.name.split('.').pop();
  const fileName = `${tenantId}/${alliedAgentId}/${documentType}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('allied-agent-documents')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const columnName = `document_${documentType}`;
  // @ts-expect-error - tabla no tipada en schema
  const { error: updateError } = await supabase
    .from('allied_agents')
    .update({ [columnName]: fileName })
    .eq('id', alliedAgentId);

  if (updateError) throw updateError;

  return fileName;
}

export async function getDocumentSignedUrl(path: string): Promise<string> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.storage
    .from('allied-agent-documents')
    .createSignedUrl(path, 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAlliedAgentDocument(
  alliedAgentId: string,
  documentType: DocumentType,
  currentPath: string
): Promise<void> {
  const supabase = getBrowserClient();
  
  const { error: deleteError } = await supabase.storage
    .from('allied-agent-documents')
    .remove([currentPath]);

  if (deleteError) throw deleteError;

  const columnName = `document_${documentType}`;
  // @ts-expect-error - tabla no tipada en schema
  const { error: updateError } = await supabase
    .from('allied_agents')
    .update({ [columnName]: null })
    .eq('id', alliedAgentId);

  if (updateError) throw updateError;
}

// COMISIONES

export async function getAlliedAgentCommissions(): Promise<AlliedAgentCommissionWithPolicy[]> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agent_commissions')
    .select(`
      *,
      allied_agent:allied_agents(id, full_name),
      policy:policies(
        id,
        policy_number,
        premium,
        client:clients(id, full_name),
        insurance_company:insurance_companies(id, name),
        insurance_line:insurance_lines(id, name)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AlliedAgentCommissionWithPolicy[];
}

export async function getCommissionsByAlliedAgent(
  alliedAgentId: string
): Promise<AlliedAgentCommissionWithPolicy[]> {
  const supabase = getBrowserClient();
  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agent_commissions')
    .select(`
      *,
      policy:policies(
        id,
        policy_number,
        premium,
        client:clients(id, full_name),
        insurance_company:insurance_companies(id, name),
        insurance_line:insurance_lines(id, name)
      )
    `)
    .eq('allied_agent_id', alliedAgentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AlliedAgentCommissionWithPolicy[];
}

export async function updateCommissionStatus(
  commissionId: string,
  status: 'pending' | 'paid'
): Promise<AlliedAgentCommission> {
  const supabase = getBrowserClient();
  const updateData = {
    status,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  };

  // @ts-expect-error - tabla no tipada en schema
  const { data, error } = await supabase
    .from('allied_agent_commissions')
    .update(updateData)
    .eq('id', commissionId)
    .select()
    .single();

  if (error) throw error;
  return data as AlliedAgentCommission;
}

// PORTAL DEL ALIADO

export async function getAlliedAgentPolicies(
  alliedAgentId: string
): Promise<AlliedAgentPolicy[]> {
  const supabase = getBrowserClient();
  
  // @ts-expect-error - campo allied_agent_id no tipado
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id')
    .eq('allied_agent_id', alliedAgentId);

  if (clientsError) throw clientsError;
  if (!clients || clients.length === 0) return [];

  const clientIds = clients.map((c: { id: string }) => c.id);

  const { data: policies, error: policiesError } = await supabase
    .from('policies')
    .select(`
      id,
      policy_number,
      premium,
      status,
      start_date,
      end_date,
      document_url,
      client:clients(id, full_name),
      insurance_company:insurance_companies(id, name),
      insurance_line:insurance_lines(id, name)
    `)
    .in('client_id', clientIds)
    .order('created_at', { ascending: false });

  if (policiesError) throw policiesError;

  // @ts-expect-error - tipos de policies
  const policyIds = (policies || []).map((p) => p.id);
  
  // @ts-expect-error - tabla no tipada en schema
  const { data: commissions } = await supabase
    .from('allied_agent_commissions')
    .select('id, policy_id, commission_amount, status, paid_at')
    .in('policy_id', policyIds);

  // @ts-expect-error - tipos de policies y commissions
  return (policies || []).map((policy) => ({
    ...policy,
    commission: commissions?.find((c) => c.policy_id === policy.id),
  })) as AlliedAgentPolicy[];
}

export async function getAlliedAgentStats(
  alliedAgentId: string
): Promise<AlliedAgentStats> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .rpc('get_allied_agent_stats', { p_allied_agent_id: alliedAgentId });

  if (error) throw error;
  return data as AlliedAgentStats;
}

// REPORTES

export async function getAlliedAgentsReport(): Promise<AlliedAgentReport[]> {
  const agents = await getAlliedAgents();
  
  const reports: AlliedAgentReport[] = await Promise.all(
    agents.filter(a => a.is_active).map(async (agent) => {
      const stats = await getAlliedAgentStats(agent.id!);
      
      return {
        allied_agent_id: agent.id!,
        allied_agent_name: agent.full_name,
        commission_percentage: agent.commission_percentage,
        total_clients: stats.total_clients,
        total_policies: stats.total_policies,
        total_premium: stats.total_premium,
        pending_commissions: stats.pending_commissions,
        paid_commissions: stats.paid_commissions,
        total_commissions: stats.pending_commissions + stats.paid_commissions,
      };
    })
  );

  return reports;
}

export async function updateClientAlliedAgent(
  clientId: string,
  alliedAgentId: string | null
): Promise<void> {
  const supabase = getBrowserClient();
  // @ts-expect-error - campo allied_agent_id no tipado
  const { error } = await supabase
    .from('clients')
    .update({ allied_agent_id: alliedAgentId })
    .eq('id', clientId);

  if (error) throw error;
}
