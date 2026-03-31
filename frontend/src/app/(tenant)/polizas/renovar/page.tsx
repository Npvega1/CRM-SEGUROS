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

      // 1. Primero: Crear la nueva póliza (renovación)
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
          currency: data.currency || 'COP',
          premium: data.premium || 0,
          gastos_expedicion: data.gastos_expedicion || 0,
          iva: data.iva || 0,
          total_a_pagar: data.total_a_pagar || 0,
          commission_pct: data.commission_pct || 0,
          fecha_expedicion: data.fecha_expedicion || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
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

      // 2. Segundo: Marcar la póliza original y sus anexos como "inactiva"
      //    Usamos neq para NO afectar la nueva póliza recién creada
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('policies')
        .update({
          status: 'inactiva',
          updated_at: new Date().toISOString()
        })
        .eq('policy_number', originalPolicy.policy_number)
        .eq('tenant_id', tenantId)
        .neq('id', newPolicy.id);

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
      <div className="container mx-auto py-6 px-4 text-center">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-muted-foreground mt-2">{error || 'Póliza no encontrada'}</p>
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
    <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleCancel} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <RefreshCw className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Renovar Póliza</h1>
          <p className="text-sm text-muted-foreground">
            Renovación de {originalPolicy.policy_number} - {clientName}
          </p>
        </div>
      </div>

      {/* Info de la póliza original */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-blue-700" />
            <span className="font-semibold text-blue-800">Póliza Original</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Número</span>
              <p className="font-medium">{originalPolicy.policy_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Aseguradora</span>
              <p className="font-medium">{opAny.insurance_company?.name || originalPolicy.insurer}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Prima</span>
              <p className="font-medium">{formatCurrency(originalPolicy.premium || 0)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vencimiento</span>
              <p className="font-medium">
                {originalPolicy.end_date
                  ? new Date(originalPolicy.end_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
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
                  <p className="font-medium group-hover:text-blue-700">{option.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Formulario de renovación */}
      {selectedOption && (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
              {RENEWAL_OPTIONS.find(o => o.value === selectedOption)?.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedOption(null);
                setError(null);
              }}
              className="text-xs text-muted-foreground"
            >
              Cambiar
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Datos de la Renovación</CardTitle>
              <CardDescription>
                Verifica y ajusta los datos de la nueva póliza. Las fechas se calculan automáticamente.
              </CardDescription>
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
