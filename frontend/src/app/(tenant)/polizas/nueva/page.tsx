'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PolicyForm, type PolicyFormData } from '@/components/modules/policies/PolicyForm';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search, Loader2, User } from 'lucide-react';
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
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/polizas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Crear Nueva Póliza</h1>
            <p className="text-sm text-muted-foreground">Registra una nueva póliza de seguro</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Selector de Cliente - Buscador Dropdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Seleccionar Cliente
          </CardTitle>
          <CardDescription>Busca y selecciona el cliente para la póliza</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClients ? (
            <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Cargando clientes...</span>
            </div>
          ) : !selectedClientId ? (
            <div ref={dropdownRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o documento..."
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setIsDropdownOpen(true); }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="pl-10"
                  data-testid="client-search-input"
                />
              </div>
              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredClients.length > 0 ? filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelectedClientId(client.id);
                        setIsDropdownOpen(false);
                        setClientSearch('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/50 border-b last:border-b-0 flex justify-between items-center transition-colors"
                      data-testid={`client-option-${client.id}`}
                    >
                      <span className="font-medium text-sm">{client.full_name}</span>
                      <span className="text-xs text-muted-foreground">{client.doc_number}</span>
                    </button>
                  )) : (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                      No se encontraron clientes
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <User className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{selectedClient?.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedClient?.doc_number}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedClientId(''); setClientSearch(''); }}
                className="text-xs h-8"
                data-testid="change-client-btn"
              >
                Cambiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulario de Póliza */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Datos de la Póliza
          </CardTitle>
          <CardDescription>
            {selectedClient ? `Póliza para: ${selectedClient.full_name}` : 'Selecciona un cliente primero'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedClientId ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Selecciona un cliente para crear la póliza</p>
            </div>
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
