'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PolicyForm, type PolicyFormData } from '@/components/modules/policies/PolicyForm';
import { ArrowLeft, Loader2, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';

export default function EditarPolizaPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenant();
  const supabase = createClient();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // Cargar poliza existente
  // =====================================================
  useEffect(() => {
    async function loadPolicy() {
      if (!policyId || !tenantId) return;

      try {
        const { data, error } = await (supabase as any)
          .from('policies')
          .select('*, client:clients(id, full_name, doc_type, doc_number)')
          .eq('id', policyId)
          .eq('tenant_id', tenantId)
          .single();

        if (error) throw error;
        setPolicy(data);
      } catch (err) {
        console.error('Error loading policy:', err);
        toast.error('Error al cargar la póliza');
      } finally {
        setLoading(false);
      }
    }
    loadPolicy();
  }, [policyId, tenantId, supabase]);

  // =====================================================
  // Guardar cambios
  // =====================================================
  const handleSubmit = async (data: PolicyFormData) => {
    if (!policyId || !tenantId) return;
    setSaving(true);
    setError(null);

    try {
      const updatePayload: Record<string, any> = {
        policy_number: data.policy_number,
        anexo: data.anexo || '00',
        insurer: data.insurer,
        insurer_id: data.insurer_id || null,
        line: data.line,
        line_id: data.line_id || null,
        group_id: data.group_id || null,
        status: data.status || 'activa',
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
        tomador_numero_identificacion: data.tomador_numero_identificacion || null,
        asegurado_diferente: data.asegurado_diferente || false,
        asegurado_nombre: data.asegurado_nombre || null,
        asegurado_numero_identificacion: data.asegurado_numero_identificacion || null,
        beneficiarios: data.beneficiarios || null,
        allied_agent_id: data.allied_agent_id || null,
        allied_agent_pct: data.allied_agent_pct || 0,
        comercial_id: data.comercial_id || null,
        grupo_empresarial_id: data.grupo_empresarial_id || null,
        notas: data.notas || null,
        metadata: data.metadata || {},
        updated_at: new Date().toISOString(),
      };

      // =====================================================
      // CRITICO: Campos enum con CHECK constraint en Supabase
      // Solo incluirlos si tienen valor valido (NO vacio)
      // =====================================================
      if (data.tipo_movimiento && data.tipo_movimiento !== '') {
        updatePayload.tipo_movimiento = data.tipo_movimiento;
      }
      if (data.tomador_tipo_identificacion && data.tomador_tipo_identificacion !== '') {
        updatePayload.tomador_tipo_identificacion = data.tomador_tipo_identificacion;
      }
      if (data.asegurado_diferente && data.asegurado_tipo_identificacion && data.asegurado_tipo_identificacion !== '') {
        updatePayload.asegurado_tipo_identificacion = data.asegurado_tipo_identificacion;
      }

      const { error: updateError } = await (supabase as any)
        .from('policies')
        .update(updatePayload)
        .eq('id', policyId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      toast.success('Póliza actualizada correctamente');
      router.push(`/polizas/${policyId}`);
    } catch (err: any) {
      console.error('Error updating policy:', err);
      setError(err.message || 'Error al actualizar la póliza');
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // Estados de carga
  // =====================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Póliza no encontrada</p>
          <Link href="/polizas">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Pólizas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header - mismo estilo que Crear Póliza */}
      <div className="flex items-center gap-4">
        <Link href={`/polizas/${policyId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Editar Póliza</h1>
            <p className="text-sm text-muted-foreground">
              {policy.policy_number} - {policy.insurance_company?.name || policy.insurer}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Formulario dentro de Card - mismo estilo que Crear Póliza */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Datos de la Póliza
          </CardTitle>
          <CardDescription>
            Editando póliza de: {policy.client?.full_name || 'Cliente'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PolicyForm
            policy={policy}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/polizas/${policyId}`)}
            isLoading={saving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
