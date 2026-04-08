'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PolicyForm, type PolicyFormData } from '@/components/modules/policies/PolicyForm';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search, Loader2, Plus, X, UserSearch } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';

function NewPolicyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');
  const { isLoading: isLoadingTenant, tenantId, userId } = useTenant();
  const searchRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [showResults, setShowResults] = useState(false);

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
          .limit(500);
        setClients((data || []) as Client[]);
      } catch (err) {
        console.error('Error loading clients:', err);
      }
      setIsLoadingClients(false);
    }
    if (tenantId) loadClients();
  }, [tenantId]);

  useEffect(() => {
    if (preselectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === preselectedClientId);
      if (client) setClientSearch(client.full_name);
    }
  }, [preselectedClientId, clients]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = clientSearch.length >= 2
    ? clients.filter(client =>
        client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.doc_number.includes(clientSearch)
      ).slice(0, 20)
    : [];

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientSearch(client.full_name);
    setShowResults(false);
  };

  const handleSearchChange = (value: string) => {
    setClientSearch(value);
    if (selectedClientId) setSelectedClientId('');
    setShowResults(value.length >= 2);
  };

  const handleClearSelection = () => {
    setSelectedClientId('');
    setClientSearch('');
    setShowResults(false);
  };

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
          placa: data.placa || null,
          insurer: data.insurer,
          insurer_id: data.insurer_id || null,
          line: data.line,
          line_id: data.line_id || null,
          group_id: data.group_id || null,
          status: data.status || 'activa',
          tipo_movimiento: 'expedicion',
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
          usuario_id: data.usuario_id || null,
          fecha_expedicion: data.fecha_expedicion || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          dias_vigencia: data.dias_vigencia || null,
          tomador_nombre: data.tomador_nombre || null,
          tomador_tipo_identificacion: data.tomador_tipo_identificacion || null,
          tomador_numero_identificacion: data.tomador_numero_identificacion || null,
          asegurado_diferente: data.asegurado_diferente || false,
          asegurado_nombre: data.asegurado_nombre || null,
          asegurado_tipo_identificacion: data.asegurado_tipo_identificacion || null,
          asegurado_numero_identificacion: data.asegurado_numero_identificacion || null,
          beneficiarios: data.beneficiarios || null,
          notas: data.notas || null,
          metadata: data.metadata || {}
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message || 'Error al crear la póliza');
        setIsLoading(false);
        return;
      }

      // Guardar documentos pendientes
      if (data.pendingDocuments && data.pendingDocuments.length > 0) {
        for (const doc of data.pendingDocuments) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('policy_documents')
            .insert({
              policy_id: newPolicy.id,
              tenant_id: tenantId,
              document_type: doc.document_type,
              document_name: doc.file_name,
              file_name: doc.file_name,
              file_url: doc.file_url,
              file_size: doc.file_size
            });
        }
      }

      router.push(`/polizas/${newPolicy.id}`);
    } catch (err) {
      console.error('Error creating policy:', err);
      setError('Error de conexión');
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/polizas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Pólizas
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Crear Nueva Póliza
        </h1>
        <p className="text-muted-foreground">Registra una nueva póliza de seguro</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 border border-red-200 bg-red-50 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Buscador de Tomador dentro de Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar Tomador *
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Escribe el nombre o documento del tomador..."
                value={clientSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => { if (clientSearch.length >= 2 && !selectedClientId) setShowResults(true); }}
                className="pl-10"
              />
              {selectedClientId && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {showResults && !selectedClientId && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {isLoadingClients ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Cargando...
                  </div>
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/50 text-sm border-b last:border-0"
                    >
                      <p className="font-medium">{client.full_name}</p>
                      <p className="text-xs text-muted-foreground">{client.doc_number}</p>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">No se encontró &quot;{clientSearch}&quot;</p>
                    <Link href="/clientes/nuevo">
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Crear nuevo cliente
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Estado vacío cuando no hay cliente seleccionado */}
          {!selectedClientId && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <UserSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Busca y selecciona un tomador para comenzar</p>
              <p className="text-xs text-muted-foreground mt-1">Escribe al menos 2 caracteres para buscar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulario solo cuando hay cliente seleccionado */}
      {selectedClientId && selectedClient && (
        <PolicyForm
          clientId={selectedClientId}
          selectedClient={selectedClient}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
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
