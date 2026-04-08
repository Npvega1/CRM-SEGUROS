'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileEdit, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';
import { PolicyModificationForm } from '@/components/modules/policies/PolicyModificationForm';

interface ParentPolicyInfo {
  id: string;
  policy_number: string;
  anexo: string;
  client_id: string;
  client_name: string;
  insurer: string;
  insurer_id: string | null;
  line: string;
  line_id: string | null;
  group_id: string | null;
  start_date: string | null;
  end_date: string | null;
  premium: number;
  commission_pct: number;
  allied_agent_id: string | null;
  allied_agent_pct: number;
}

export default function ModificarPolizaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const polizaId = searchParams.get('poliza');

  const { isLoading: isLoadingTenant, tenantId } = useTenant();

  const [parentPolicy, setParentPolicy] = useState<ParentPolicyInfo | null>(null);
  const [nextAnexo, setNextAnexo] = useState('01');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const loadParentPolicy = useCallback(async () => {
    if (!tenantId || !polizaId) return;

    if (!isValidUUID(polizaId)) {
      setError('ID de póliza inválido');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      // Cargar la póliza padre
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: policyData, error: fetchError } = await (supabase as any)
        .from('policies')
        .select(`
          id,
          policy_number,
          anexo,
          client_id,
          insurer,
          insurer_id,
          line,
          line_id,
          group_id,
          start_date,
          end_date,
          premium,
          commission_pct,
          allied_agent_id,
          allied_agent_pct,
          clients!inner(full_name)
        `)
        .eq('id', polizaId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) {
        setError(fetchError.message || 'Error al cargar la póliza');
        setIsLoading(false);
        return;
      }

      if (!policyData) {
        setError('Póliza no encontrada');
        setIsLoading(false);
        return;
      }

      // Buscar el último anexo existente para esta póliza
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: anexosData } = await (supabase as any)
        .from('policies')
        .select('anexo')
        .eq('policy_number', policyData.policy_number)
        .eq('tenant_id', tenantId)
        .order('anexo', { ascending: false })
        .limit(1);

      // Calcular el siguiente anexo
      let maxAnexo = '00';
      if (anexosData && anexosData.length > 0) {
        maxAnexo = anexosData[0].anexo || '00';
      }

      // Incrementar el anexo
      const nextAnexoNum = parseInt(maxAnexo, 10) + 1;
      const calculatedNextAnexo = nextAnexoNum.toString().padStart(2, '0');
      setNextAnexo(calculatedNextAnexo);

      // Establecer la información de la póliza padre
      setParentPolicy({
        id: policyData.id,
        policy_number: policyData.policy_number,
        anexo: policyData.anexo || '00',
        client_id: policyData.client_id,
        client_name: policyData.clients?.full_name || 'Cliente desconocido',
        insurer: policyData.insurer,
        insurer_id: policyData.insurer_id,
        line: policyData.line,
        line_id: policyData.line_id,
        group_id: policyData.group_id,
        start_date: policyData.start_date,
        end_date: policyData.end_date,
        premium: policyData.premium || 0,
        commission_pct: policyData.commission_pct || 0,
        allied_agent_id: policyData.allied_agent_id || null,
        allied_agent_pct: policyData.allied_agent_pct || 0
      });

    } catch (err) {
      console.error('Error loading policy:', err);
      setError('Error de conexión');
    }
    setIsLoading(false);
  }, [polizaId, tenantId]);

  useEffect(() => {
    if (tenantId && polizaId) {
      loadParentPolicy();
    } else if (!polizaId) {
      setError('No se especificó la póliza a modificar');
      setIsLoading(false);
    }
  }, [tenantId, polizaId, loadParentPolicy]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (data: any) => {
    if (!tenantId || !parentPolicy) return;

    setIsSaving(true);
    try {
      const supabase = getBrowserClient();

      // Preparar datos para insertar
      const insertData = {
        tenant_id: tenantId,
        client_id: data.client_id,
        policy_number: data.policy_number,
        anexo: data.anexo,
        insurer: data.insurer,
        insurer_id: data.insurer_id || null,
        line: data.line,
        line_id: data.line_id || null,
        group_id: data.group_id || null,
        status: 'activa',
        currency: data.currency || 'COP',
        premium: data.premium,
        gastos_expedicion: data.gastos_expedicion || 0,
        iva: data.iva || 0,
        total_a_pagar: data.total_a_pagar || 0,
        commission_pct: data.commission_pct || 0,
        allied_agent_id: parentPolicy.allied_agent_id || null,
        allied_agent_pct: parentPolicy.allied_agent_pct || 0,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        fecha_expedicion: data.fecha_expedicion || null,
        policy_type: 'anexo',
        parent_policy_id: data.parent_policy_id,
        notas: data.notas || null
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newPolicy, error: insertError } = await (supabase as any)
        .from('policies')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating modification:', insertError);
        setError(`Error al crear la modificación: ${insertError.message}`);
        setIsSaving(false);
        return;
      }

      // Actualizar el end_date de la póliza principal con la fecha del anexo
      if (data.end_date) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('policies')
          .update({
            end_date: data.end_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', parentPolicy.id)
          .eq('tenant_id', tenantId);
      }

      // Redirigir a la página de detalle de la nueva modificación
      router.push(`/polizas/${newPolicy.id}`);

    } catch (err) {
      console.error('Error:', err);
      setError('Error al guardar la modificación');
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    if (polizaId) {
      router.push(`/polizas/${polizaId}`);
    } else {
      router.push('/polizas');
    }
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen />;
  }

  if (error || !parentPolicy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-lg text-red-600">{error || 'No se pudo cargar la póliza'}</p>
        <Button variant="outline" onClick={() => router.push('/polizas')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Pólizas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Crear Modificación</h1>
          <p className="text-sm text-muted-foreground">
            Anexo {nextAnexo} sobre Póliza {parentPolicy.policy_number}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            Nueva Modificación (Anexo)
          </CardTitle>
          <CardDescription>
            Complete los datos de la modificación. Los campos de identificación
            se heredan de la póliza original.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PolicyModificationForm
            parentPolicy={parentPolicy}
            nextAnexo={nextAnexo}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSaving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
