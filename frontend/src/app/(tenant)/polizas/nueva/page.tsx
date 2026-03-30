'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm } from '@/components/modules/policies/PolicyForm';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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

interface ParentPolicyInfo {
  id: string;
  policy_number: string;
  anexo: string;
  client_name?: string;
}

interface PolicyData {
  id: string;
  policy_number: string;
  anexo: string;
  client_id: string;
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
  clients?: { name: string };
}

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

// Función para incrementar el número de anexo
const incrementAnexo = (currentAnexo: string): string => {
  const num = parseInt(currentAnexo, 10);
  if (isNaN(num)) return '01';
  const nextNum = num + 1;
  return nextNum.toString().padStart(2, '0');
};

export default function NuevaPólizaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modificacionId = searchParams.get('modificacion');
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // Estado para modificaciones
  const [isModification, setIsModification] = useState(false);
  const [parentPolicyInfo, setParentPolicyInfo] = useState<ParentPolicyInfo | null>(null);
  const [defaultValues, setDefaultValues] = useState<Record<string, unknown> | undefined>(undefined);

  const loadData = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const supabase = getBrowserClient();

      // Cargar catálogos en paralelo
      const [clientsRes, insurersRes, linesRes, groupsRes] = await Promise.all([
        supabase.from('clients').select('id, name, email').eq('tenant_id', tenantId).order('name'),
        supabase.from('insurers').select('id, name').eq('tenant_id', tenantId).order('name'),
        supabase.from('lines').select('id, name').eq('tenant_id', tenantId).order('name'),
        supabase.from('groups').select('id, name').eq('tenant_id', tenantId).order('name'),
      ]);

      setClients(clientsRes.data || []);
      setInsurers(insurersRes.data || []);
      setLines(linesRes.data || []);
      setGroups(groupsRes.data || []);

      // Si es una modificación, cargar datos de la póliza padre
      if (modificacionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: parentPolicy, error: parentError } = await (supabase as any)
          .from('policies')
          .select('*, clients(name)')
          .eq('id', modificacionId)
          .single();

        if (parentError || !parentPolicy) {
          toast.error('Póliza no encontrada para modificar');
          setLoading(false);
          return;
        }

        // Buscar el último anexo de esta póliza para incrementar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: latestAnexoData } = await (supabase as any)
          .from('policies')
          .select('anexo')
          .eq('policy_number', parentPolicy.policy_number)
          .eq('tenant_id', tenantId)
          .order('anexo', { ascending: false })
          .limit(1)
          .single();

        const currentAnexo = latestAnexoData?.anexo || parentPolicy.anexo || '00';
        const newAnexo = incrementAnexo(currentAnexo);

        setIsModification(true);
        setParentPolicyInfo({
          id: parentPolicy.id,
          policy_number: parentPolicy.policy_number,
          anexo: currentAnexo,
          client_name: parentPolicy.clients?.name,
        });

        // Pre-llenar valores (prima y valores financieros en 0 para la modificación)
        setDefaultValues({
          policy_number: parentPolicy.policy_number,
          anexo: newAnexo,
          client_id: parentPolicy.client_id,
          insurer_id: parentPolicy.insurer_id,
          line_id: parentPolicy.line_id,
          group_id: parentPolicy.group_id || '',
          status: 'vigente',
          premium: 0, // Nuevo anexo empieza en 0, usuario ingresa el ajuste
          gastos_expedicion: 0,
          iva: 0,
          total_a_pagar: 0,
          commission_pct: parentPolicy.commission_pct || 0,
          start_date: parentPolicy.start_date,
          end_date: parentPolicy.end_date,
          fecha_expedicion: new Date().toISOString().split('T')[0],
          notas: '',
        });
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar datos');
      setLoading(false);
    }
  }, [tenantId, modificacionId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadData();
    }
  }, [isLoadingTenant, tenantId, loadData]);

  const handleSubmit = async (data: PolicyFormSubmitData) => {
    if (!tenantId) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getBrowserClient();

      // Preparar datos para insertar
      const insertData = {
        tenant_id: tenantId,
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
        // Campos para modificaciones
        parent_policy_id: data.parent_policy_id || null,
        policy_type: data.policy_type || 'nueva',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newPolicy, error: insertError } = await (supabase as any)
        .from('policies')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating policy:', insertError);
        if (insertError.code === '23505') {
          setError('Ya existe una póliza con este número y anexo.');
        } else {
          setError(insertError.message || 'Error al crear la póliza');
        }
        setSubmitting(false);
        return;
      }

      toast.success(
        isModification 
          ? `Modificación (Anexo ${data.anexo}) creada exitosamente` 
          : 'Póliza creada exitosamente'
      );
      
      router.push(`/polizas/${newPolicy.id}`);
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
      setSubmitting(false);
    }
  };

  if (isLoadingTenant || loading) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/polizas">
                <Button variant="ghost" size="icon" data-testid="back-button">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-semibold">
                  {isModification ? 'Nueva Modificación de Póliza' : 'Nueva Póliza'}
                </span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{tenantName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {isModification ? 'Nueva Modificación de Póliza' : 'Nueva Póliza'}
            </CardTitle>
            <CardDescription>
              {isModification 
                ? 'Cree un nuevo anexo para modificar los términos de la póliza existente'
                : 'Complete los datos para crear una nueva póliza'
              }
            </CardDescription>
          </CardHeader>
        </Card>

        <PolicyForm
          clients={clients}
          insurers={insurers}
          lines={lines}
          groups={groups}
          onSubmit={handleSubmit}
          isLoading={submitting}
          defaultValues={defaultValues}
          isModification={isModification}
          parentPolicyInfo={parentPolicyInfo}
        />
      </main>
    </div>
  );
}
