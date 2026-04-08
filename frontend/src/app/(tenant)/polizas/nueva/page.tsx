'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PolicyForm, type PolicyFormData } from '@/components/modules/policies/PolicyForm';
import type { Client } from '@/lib/validations/clients';
import { DOC_TYPE_LABELS } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search, Loader2, User, Check, Plus, Phone, MapPin, FileText } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';

function NewPolicyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');
  const { isLoading: isLoadingTenant, tenantId, userId } = useTenant();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
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

  const handleSubmit = async (data: PolicyFormData) => {
    if (!selectedClientId) {
      setError('Debes seleccionar un tomador');
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
          tipo_movimiento: data.tipo_movimiento || null,
          currency: data.currency || 'COP',
          valor_asegurado: data.valor_asegurado || 0,
          premium: data.premium || 0,
          gastos_expedicion: data.gastos_expedicion || 0,
          iva: data.iva || 0,
          total_a_pagar: data.total_a_pagar || 0,
          commission_pct: data.commission_pct || 10,
          allied_agent_id: data.allied_agent_id || null,
          allied_agent_pct: data.allied_agent_pct || 0,
          comercial_id: data.comercial_id || null,
          grupo_empresarial_id: data.grupo_empresarial_id || null,
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
          notas: data.notas || null,
          placa: data.placa || null,
          metadata: data.metadata || {}
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message || 'Error al crear la póliza');
        setIsLoading(false);
        return;
      }

      router.push(`/polizas/${newPolicy.id}`);
    } catch (err) {
      console.error('Error creating policy:', err);
      setError('Error de conexión');
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/polizas"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver a Pólizas
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Crear Nueva Póliza
        </h1>
        <p className="text-muted-foreground mt-1">Registra una nueva póliza de seguro</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Selección del Tomador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Seleccionar Tomador
          </CardTitle>
          <CardDescription>Busca y selecciona el tomador para la póliza</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o documento..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoadingClients ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Cargando tomadores...
            </div>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedClientId === client.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{client.full_name}</p>
                        <p className="text-xs text-muted-foreground">{client.doc_number}</p>
                      </div>
                      {selectedClientId === client.id && <Check className="h-5 w-5 text-primary" />}
                    </div>
                  </button>
                ))}
                {filteredClients.length === 0 && clientSearch && (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No se encontró el tomador &quot;{clientSearch}&quot;
                    </p>
                    <Link href="/clientes/nuevo">
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Crear nuevo cliente
                      </Button>
                    </Link>
                  </div>
                )}
                {filteredClients.length === 0 && !clientSearch && (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">No hay clientes registrados</p>
                    <Link href="/clientes/nuevo">
                      <Button variant="outline" size="sm" className="mt-2 gap-1.5">
                        <Plus className="h-4 w-4" />
                        Crear nuevo cliente
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Info del Tomador seleccionado */}
              {selectedClient && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Información del Tomador</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Nombre</p>
                      <p className="font-medium">{selectedClient.full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo Identificación</p>
                      <p className="font-medium">{DOC_TYPE_LABELS[selectedClient.doc_type] || selectedClient.doc_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Número Identificación</p>
                      <p className="font-medium">{selectedClient.doc_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Teléfono</p>
                      <p className="font-medium">{selectedClient.phone || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Dirección</p>
                      <p className="font-medium">{selectedClient.address || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Formulario de la Póliza */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Datos de la Póliza
          </CardTitle>
          <CardDescription>
            {selectedClient ? `Póliza para: ${selectedClient.full_name}` : 'Selecciona un tomador primero'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedClientId ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Selecciona un tomador para crear la póliza
            </p>
          ) : (
            <PolicyForm
              clientId={selectedClientId}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>
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
