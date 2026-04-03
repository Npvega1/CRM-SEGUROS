'use client';

// =====================================================
// PÁGINA: Editar Póliza
// /polizas/[id]/editar
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm } from '@/components/modules/policies/PolicyForm';
import type { Policy, PolicyStatus } from '@/lib/validations/policies';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

interface PolicyFormData {
  client_id: string;
  policy_number: string;
  anexo: string;
  insurer: string;
  insurer_id?: string;
  line: string;
  line_id?: string;
  group_id?: string;
  status: PolicyStatus;
  currency: string;
  premium: number;
  gastos_expedicion: number;
  iva: number;
  total_a_pagar: number;
  commission_pct: number;
  fecha_expedicion?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notas?: string;
  metadata?: Record<string, unknown>;
}

export default function EditPolicyPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.id as string;
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    if (!tenantId || !policyId) return;

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('policies')
        .select('*')
        .eq('id', policyId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) {
        console.error('Error fetching policy:', fetchError);
        setError(fetchError.message || 'Error al cargar la póliza');
      } else {
        setPolicy(data as Policy);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    }
    setIsLoading(false);
  }, [policyId, tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId && policyId) {
      loadPolicy();
    }
  }, [isLoadingTenant, tenantId, policyId, loadPolicy]);

  const handleSubmit = async (data: PolicyFormData) => {
    if (!tenantId || !policyId) return;

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <div className="container mx-auto py-6 px-4">
Solo eliminas max-w-4xl para que el formulario use todo el ancho disponible.

Corrección 2B: Guardar nuevos campos al editar
BUSCAR este bloque en el handleSubmit (la operación .update()):

      const { error: updateError } = await (supabase as any)
        .from('policies')
        .update({
          policy_number: data.policy_number,
          anexo: data.anexo || '00',
          insurer: data.insurer,
          insurer_id: data.insurer_id || null,
          line: data.line,
          line_id: data.line_id || null,
          group_id: data.group_id || null,
          status: data.status || 'activa',
          premium: data.premium,
          gastos_expedicion: data.gastos_expedicion || 0,
          iva: data.iva || 0,
          total_a_pagar: data.total_a_pagar || 0,
          currency: data.currency || 'COP',
          fecha_expedicion: data.fecha_expedicion || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          commission_pct: data.commission_pct || 0,
          notas: data.notas || null,
          metadata: data.metadata || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', policyId)
        .eq('tenant_id', tenantId);
REEMPLAZAR POR:

      const { error: updateError } = await (supabase as any)
        .from('policies')
        .update({
          policy_number: data.policy_number,
          anexo: data.anexo || '00',
          insurer: data.insurer,
          insurer_id: data.insurer_id || null,
          line: data.line,
          line_id: data.line_id || null,
          group_id: data.group_id || null,
          status: data.status || 'activa',
          tipo_movimiento: data.tipo_movimiento || null,
          premium: data.premium,
          valor_asegurado: data.valor_asegurado || 0,
          gastos_expedicion: data.gastos_expedicion || 0,
          iva: data.iva || 0,
          total_a_pagar: data.total_a_pagar || 0,
          currency: data.currency || 'COP',
          fecha_expedicion: data.fecha_expedicion || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          commission_pct: data.commission_pct || 0,
          tomador_nombre: data.tomador_nombre || null,
          tomador_tipo_identificacion: data.tomador_tipo_identificacion || null,
          tomador_numero_identificacion: data.tomador_numero_identificacion || null,
          asegurado_diferente: data.asegurado_diferente || false,
          asegurado_nombre: data.asegurado_nombre || null,
          asegurado_tipo_identificacion: data.asegurado_tipo_identificacion || null,
          asegurado_numero_identificacion: data.asegurado_numero_identificacion || null,
          beneficiarios: data.beneficiarios || null,
          allied_agent_id: data.allied_agent_id || null,
          allied_agent_pct: data.allied_agent_pct || 0,
          comercial_id: data.comercial_id || null,
          grupo_empresarial_id: data.grupo_empresarial_id || null,
          notas: data.notas || null,
          metadata: data.metadata || {},
          updated_at: new Date().toISOString(),
        })
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

  const handleCancel = () => {
    router.push(`/polizas/${policyId}`);
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen />;
  }

  if (error && !policy) {
    return (
      <div className="container mx-auto py-6 px-4 text-center">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/polizas">
          <Button variant="outline" className="mt-4">Volver a Pólizas</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {error && policy && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Editar Póliza</CardTitle>
          <CardDescription>Actualiza la información de la póliza {policy?.policy_number}</CardDescription>
        </CardHeader>
        <CardContent>
          {policy && (
            <PolicyForm
              policy={policy}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={isSaving}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
