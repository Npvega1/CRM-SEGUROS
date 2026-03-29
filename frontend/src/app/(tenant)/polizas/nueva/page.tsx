'use client';

// =====================================================
// PÁGINA: Nueva Póliza
// /polizas/nueva
// INSERT con todos los campos nuevos
// =====================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm } from '@/components/modules/policies/PolicyForm';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search, UserCheck } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { getBrowserClient } from '@/lib/supabase/client';

function NewPolicyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');
  const { isLoading: isLoadingTenant, tenantName, tenantId, userId } = useTenant();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  useEffect(() => {
    async function loadClients() {
      if (!tenantId) return;

      setIsLoadingClients(true);
      try {
        const supabase = getBrowserClient();
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('full_name', { ascending: true })
          .limit(100);

        setClients((data || []) as Client[]);
      } catch (err) {
        console.error('Error loading clients:', err);
      }
      setIsLoadingClients(false);
    }
    if (tenantId) {
      loadClients();
    }
  }, [tenantId]);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.doc_number.includes(clientSearch)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (data: any) => {
    if (!selectedClientId) {
      setError('Debes seleccionar un cliente');
      return;
    }

    if (!tenantId || !userId) {
      setError('No hay sesión activa');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getBrowserClient();

      // INSERT con TODOS los campos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newPolicy, error: insertError } = await (supabase as any)
        .from('policies')
        .insert({
          tenant_id: tenantId,
          client_id: selectedClientId,
          policy_number: data.policy_number,
          anexo: data.anexo || '00',
          insurer: data.insurer,
          insurer_id: data.insurer_id || null,
          line: data.line,
          line_id: data.line_id || null,
          group_id: data.group_id || null,
          status: data.status || 'activa',
          currency: data.currency || 'COP',
          premium: data.premium || 0,
          gastos_expedicion: data.gastos_expedicion || 0,
          iva: data.iva || 0,
          total_a_pagar: data.total_a_pagar || 0,
          commission_pct: data.commission_pct || 10,
          fecha_expedicion: data.fecha_expedicion || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          metadata: data.metadata || {}
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message || 'Error al crear la póliza');
        setIsLoading(false);
      } else {
        router.push(`/polizas/${newPolicy.id}`);
      }
    } catch {
      setError('Error de conexión');
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Nueva Póliza
          </h1>
          <p className="text-sm text-muted-foreground">{tenantName}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* PASO 1: Selección de Cliente */}
      {!selectedClientId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Paso 1: Seleccionar Cliente
            </CardTitle>
            <CardDescription>Busca y selecciona el cliente para crear la póliza</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o documento..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {isLoadingClients ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-muted-foreground">Cargando clientes...</span>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className="w-full text-left p-4 rounded-lg border transition-colors hover:bg-muted/50 hover:border-primary"
                  >
                    <p className="font-medium">{client.full_name}</p>
                    <p className="text-sm text-muted-foreground">{client.doc_number}</p>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No se encontraron clientes
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* PASO 2: Formulario de Póliza */
        <div className="space-y-4">
          {/* Cliente seleccionado */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Cliente seleccionado</p>
                <p className="font-semibold text-slate-800">{selectedClient?.full_name}</p>
                <p className="text-xs text-slate-500">{selectedClient?.doc_number}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedClientId('')}
            >
              Cambiar cliente
            </Button>
          </div>

          {/* Formulario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Paso 2: Datos de la Póliza
              </CardTitle>
              <CardDescription>
                Completa la información de la póliza
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PolicyForm
                clientId={selectedClientId}
                onSubmit={handleSubmit}
                onCancel={() => router.back()}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function NewPolicyPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <NewPolicyContent />
    </Suspense>
  );
}
