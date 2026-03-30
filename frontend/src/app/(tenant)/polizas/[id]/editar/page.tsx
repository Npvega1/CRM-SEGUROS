'use client';

// =====================================================
// PÁGINA: Editar Póliza
// /polizas/[id]/editar
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm } from '@/components/modules/policies/PolicyForm';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Insurer {
  id: string;
  name: string;
}

interface Line {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
}

interface PolicyData {
  id: string;
  tenant_id: string;
  client_id: string;
  policy_number: string;
  anexo: string;
  insurer_id: string;
  line_id: string;
  group_id: string | null;
  status: string;
  premium: number;
  gastos_expedicion: number;
  iva: number;
  total_a_pagar: number;
  commission_pct: number;
  start_date: string;
  end_date: string;
  fecha_expedicion: string | null;
  notas: string | null;
}

// Tipo para los datos del formulario
interface PolicyFormSubmitData {
  policy_number: string;
  anexo: string;
  client_id: string;
  insurer_id: string;
  line_id: string;
  group_id?: string | null;
  status: string;
  premium: number;
  gastos_expedicion: number;
  iva: number;
  total_a_pagar: number;
  commission_pct: number;
  start_date: string;
  end_date: string;
  fecha_expedicion?: string | null;
  notas?: string | null;
  parent_policy_id?: string;
  policy_type?: string;
}

export default function EditPolicyPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.id as string;
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId || !policyId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      // Cargar póliza y catálogos en paralelo
      const [policyRes, clientsRes, insurersRes, linesRes, groupsRes] = await Promise.all([
        supabase
          .from('policies')
          .select('*')
          .eq('id', policyId)
          .eq('tenant_id', tenantId)
          .single(),
        supabase.from('clients').select('id, name, email').eq('tenant_id', tenantId).order('name'),
        supabase.from('insurers').select('id, name').eq('tenant_id', tenantId).order('name'),
        supabase.from('lines').select('id, name').eq('tenant_id', tenantId).order('name'),
        supabase.from('groups').select('id, name').eq('tenant_id', tenantId).order('name'),
      ]);
      
      if (policyRes.error) {
        console.error('Error fetching policy:', policyRes.error);
        setError(policyRes.error.message || 'Error al cargar la póliza');
      } else {
        setPolicy(policyRes.data as PolicyData);
      }

      setClients(clientsRes.data || []);
      setInsurers(insurersRes.data || []);
      setLines(linesRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    }
    setIsLoading(false);
  }, [policyId, tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId && policyId) {
      loadData();
    }
  }, [isLoadingTenant, tenantId, policyId, loadData]);

  const handleSubmit = async (data: PolicyFormSubmitData) => {
    if (!tenantId || !policyId) return;
    
    setIsSaving(true);
    setError(null);

    try {
      const supabase = getBrowserClient();
      
      const updatePayload = {
        policy_number: data.policy_number,
        anexo: data.anexo,
        client_id: data.client_id,
        insurer_id: data.insurer_id,
        line_id: data.line_id,
        group_id: data.group_id || null,
        status: data.status,
        premium: data.premium,
        gastos_expedicion: data.gastos_expedicion,
        iva: data.iva,
        total_a_pagar: data.total_a_pagar,
        commission_pct: data.commission_pct,
        start_date: data.start_date,
        end_date: data.end_date,
        fecha_expedicion: data.fecha_expedicion || null,
        notas: data.notas || null,
        updated_at: new Date().toISOString(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('policies')
        .update(updatePayload)
        .eq('id', policyId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Error updating policy:', updateError);
        if (updateError.code === '23505') {
          setError('Ya existe una póliza con este número.');
        } else {
          setError(updateError.message || 'Error al actualizar');
        }
        setIsSaving(false);
        return;
      }

      router.push(`/polizas/${policyId}`);
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
      setIsSaving(false);
    }
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando póliza..." />;
  }

  if (error && !policy) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link href="/polizas">
            <Button>Volver a Pólizas</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Preparar valores por defecto para el formulario
  const defaultValues = policy ? {
    policy_number: policy.policy_number,
    anexo: policy.anexo || '00',
    client_id: policy.client_id,
    insurer_id: policy.insurer_id,
    line_id: policy.line_id,
    group_id: policy.group_id || '',
    status: policy.status || 'vigente',
    premium: policy.premium || 0,
    gastos_expedicion: policy.gastos_expedicion || 0,
    iva: policy.iva || 0,
    total_a_pagar: policy.total_a_pagar || 0,
    commission_pct: policy.commission_pct || 0,
    start_date: policy.start_date || '',
    end_date: policy.end_date || '',
    fecha_expedicion: policy.fecha_expedicion || '',
    notas: policy.notas || '',
  } : undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href={`/polizas/${policyId}`}>
                <Button variant="ghost" size="icon" data-testid="back-button">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Editar Póliza</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{tenantName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && policy && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Editar Póliza</CardTitle>
            <CardDescription>
              Actualiza la información de la póliza {policy?.policy_number}
            </CardDescription>
          </CardHeader>
        </Card>

        {policy && (
          <PolicyForm
            clients={clients}
            insurers={insurers}
            lines={lines}
            groups={groups}
            onSubmit={handleSubmit}
            isLoading={isSaving}
            defaultValues={defaultValues}
          />
        )}
      </main>
    </div>
  );
}
