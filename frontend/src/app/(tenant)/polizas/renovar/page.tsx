'use client';

// =====================================================
// PÁGINA: Renovar Póliza
// /polizas/renovar?poliza=[id]
// =====================================================

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PolicyForm, type PolicyFormData } from '@/components/modules/policies/PolicyForm';
import type { Policy, PolicyStatus } from '@/lib/validations/policies';
import { ArrowLeft, RefreshCw, FileText, ArrowRight } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

type RenewalOption = 'same_number' | 'new_number' | 'new_company';

const RENEWAL_OPTIONS: { value: RenewalOption; label: string; description: string }[] = [
  {
    value: 'same_number',
    label: 'Mismo número, misma compañía',
    description: 'Se renueva la póliza con el mismo número y la misma aseguradora.'
  },
  {
    value: 'new_number',
    label: 'Nuevo número, misma compañía',
    description: 'La aseguradora asigna un nuevo número de póliza pero se mantiene la misma compañía.'
  },
  {
    value: 'new_company',
    label: 'Otra compañía',
    description: 'Se renueva la póliza con una compañía diferente. Se pre-carga solo el cliente.'
  }
];

function RenewPolicyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const originalPolicyId = searchParams.get('poliza');
  const { isLoading: isLoadingTenant, tenantId, userId } = useTenant();

  const [originalPolicy, setOriginalPolicy] = useState<Policy | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true);
  const [selectedOption, setSelectedOption] = useState<RenewalOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOriginalPolicy = useCallback(async () => {
    if (!tenantId || !originalPolicyId) return;

    setIsLoadingPolicy(true);
    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('policies')
        .select(`
          *,
          clients!inner(id, full_name),
          insurance_company:insurance_companies(id, name, slug),
          insurance_line:insurance_lines(id, name, slug),
          insurance_group:insurance_groups(id, name, slug)
        `)
        .eq('id', originalPolicyId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) {
        setError('No se pudo cargar la póliza original');
      } else {
        setOriginalPolicy(data as Policy);
      }
    } catch {
      setError('Error de conexión');
    }
    setIsLoadingPolicy(false);
  }, [tenantId, originalPolicyId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId && originalPolicyId) {
      loadOriginalPolicy();
    }
  }, [isLoadingTenant, tenantId, originalPolicyId, loadOriginalPolicy]);

  const buildPrefilledPolicy = (): Policy | undefined => {
    if (!originalPolicy || !selectedOption) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = originalPolicy as any;

    const originalEndDate = op.end_date ? new Date(op.end_date) : new Date();
    const newStartDate = new Date(originalEndDate);
    newStartDate.setDate(newStartDate.getDate() + 1);
    const newEndDate = new Date(newStartDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    const base = {
      ...originalPolicy,
      id: '',
      status: 'activa' as PolicyStatus,
      anexo: '00',
      tipo_movimiento: 'renovacion',
      policy_type: 'renovacion',
      renewed_from_policy_id: originalPolicyId,
      fecha_expedicion: new Date().toISOString().split('T')[0],
      start_date: newStartDate.toISOString().split('T')[0],
      end_date: newEndDate.toISOString().split('T')[0],
      notas: '',
    };

    switch (selectedOption) {
      case 'same_number':
        return base as Policy;

      case 'new_number':
        return {
          ...base,
          policy_number: '',
        } as Policy;

      case 'new_company':
        return {
          ...base,
          policy_number: '',
          insurer: '',
          insurer_id: null,
          line: 'otro',
          line_id: null,
          group_id: null,
          premium: 0,
          valor_asegurado: 0,
          gastos_expedicion: 0,
          iva: 0,
          total_a_pagar: 0,
          commission_pct: 0,
        } as unknown as Policy;

      default:
        return base as Policy;
    }
  };

  const handleSubmit = async (data: PolicyFormData) => {
    if (!tenantId || !userId || !originalPolicy || !originalPolicyId) return;

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getBrowserClient();

      // 1. Crear la nueva póliza (renovación)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newPolicy, error: insertError } = await (supabase as any)
        .from('policies')
        .insert({
          tenant_id: tenantId,
          client_id: originalPolicy.client_id,
          policy_number: data.policy_number,
          anexo: '00',
          insurer: data.insurer,
          insurer_id: data.insurer_id || null,
          line: data.line,
          line_id: data.line_id || null,
          group_id: data.group_id || null,
          status: 'activa',
          tipo_movimiento: 'renovacion',
          currency: data.currency || 'COP',
          valor_asegurado: data.valor_asegurado || 0,
          premium: data.premium || 0,
          gastos_expedicion: data.gastos_expedicion || 0,
          iva: data.iva || 0,
          total_a_pagar: data.total_a_pagar || 0,
          commission_pct: data.commission_pct || 0,
          fecha_expedicion: data.fecha_expedicion || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
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
          usuario_id: data.usuario_id || null,
          notas: data.notas || null,
          policy_type: 'renovacion',
          renewed_from_policy_id: originalPolicyId,
          metadata: data.metadata || {}
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Ya existe una póliza con este número, anexo y fecha de inicio.');
        } else {
          setError(insertError.message || 'Error al crear la renovación');
        }
        setIsSaving(false);
        return;
      }

      // 2. Llamar función RPC para desactivar pólizas de la vigencia anterior
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcError } = await (supabase.rpc as any)('deactivate_old_policies', {
        p_policy_number: originalPolicy.policy_number,
        p_tenant_id: tenantId,
        p_exclude_id: newPolicy.id
      });

      if (rpcError) {
        console.error('Error deactivating old policies:', rpcError);
      }

      // 3. Redirigir a la nueva póliza
      router.push(`/polizas/${newPolicy.id}`);

    } catch {
      setError('Error de conexión');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalPolicyId) {
      router.push(`/polizas/${originalPolicyId}`);
    } else {
      router.push('/polizas');
    }
  };

  if (isLoadingTenant || isLoadingPolicy) {
    return <LoadingScreen />;
  }

  if (!originalPolicy) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4">
        <h2 className="text-xl font-bold mb-4">Error</h2>
        <p className="text-muted-foreground">{error || 'Póliza no encontrada'}</p>
        <Link href="/polizas">
          <Button variant="outline" className="mt-4">Volver a Pólizas</Button>
        </Link>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opAny = originalPolicy as any;
  const clientName = opAny.clients?.full_name || 'Cliente';

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const prefilledPolicy = buildPrefilledPolicy();

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/polizas/${originalPolicyId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Renovar Póliza</h1>
          <p className="text-sm text-muted-foreground">
            Renovación de {originalPolicy.policy_number} - {clientName}
          </p>
        </div>
      </div>

      {/* Info de la póliza original */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Número</p>
              <p className="text-sm font-medium">{originalPolicy.policy_number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aseguradora</p>
              <p className="text-sm font-medium">{opAny.insurance_company?.name || originalPolicy.insurer}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prima</p>
              <p className="text-sm font-medium">{formatCurrency(originalPolicy.premium || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimiento</p>
              <p className="text-sm font-medium">
                {originalPolicy.end_date
                  ? new Date(originalPolicy.end_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Paso 1: Seleccionar tipo de renovación */}
      {!selectedOption && (
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Renovación</CardTitle>
            <CardDescription>Selecciona cómo deseas renovar esta póliza</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RENEWAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setSelectedOption(option.value);
                  setError(null);
                }}
                className="w-full text-left p-4 rounded-lg border hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-between group"
              >
                <div>
                  <p className="font-medium text-sm">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Formulario de renovación */}
      {selectedOption && (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {RENEWAL_OPTIONS.find(o => o.value === selectedOption)?.label}
            </Badge>
            <button
              onClick={() => {
                setSelectedOption(null);
                setError(null);
              }}
              className="text-xs text-muted-foreground"
            >
              Cambiar
            </button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Datos de la Renovación</CardTitle>
              <CardDescription>Verifica y ajusta los datos de la nueva póliza. Las fechas se calculan automáticamente.</CardDescription>
            </CardHeader>
            <CardContent>
              {prefilledPolicy && (
                <PolicyForm
                  policy={prefilledPolicy}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                  isLoading={isSaving}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function RenewPolicyPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RenewPolicyContent />
    </Suspense>
  );
}
