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
import type { Policy, PolicyStatus } from '@/lib/validations/policies';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

interface PolicyFormData {
  client_id: string;
  policy_number: string;
  insurer: string;
  insurer_id?: string;
  line: string;
  line_id?: string;
  group_id?: string;
  status: PolicyStatus;
  premium: number;
  currency?: string;
  start_date?: string | null;
  end_date?: string | null;
  commission_pct?: number;
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
      const { error: updateError } = await (supabase as any)
        .from('policies')
        .update({
          policy_number: data.policy_number,
          insurer: data.insurer,
          insurer_id: data.insurer_id || null,
          line: data.line,
          line_id: data.line_id || null,
          group_id: data.group_id || null,
          premium: data.premium,
          currency: data.currency || 'COP',
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          commission_pct: data.commission_pct || 0,
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && policy && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Editar Póliza</CardTitle>
            <CardDescription>
              Actualiza la información de la póliza {policy?.policy_number}
            </CardDescription>
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
      </main>
    </div>
  );
}
