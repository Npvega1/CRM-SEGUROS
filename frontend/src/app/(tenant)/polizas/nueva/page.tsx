'use client';

// =====================================================
// PÁGINA: Nueva Póliza
// /polizas/nueva
// =====================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm } from '@/components/modules/policies/PolicyForm';
import { createPolicy } from '../actions';
import { listClients } from '../../clientes/actions';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

// Tipo para el formulario
interface PolicyFormData {
  client_id: string;
  policy_number: string;
  insurer: string;
  line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
  status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
  premium: number;
  currency?: string;
  start_date?: string | null;
  end_date?: string | null;
  commission_pct?: number;
  metadata?: Record<string, unknown>;
}

function NewPolicyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');
  const { isLoading: isLoadingTenant, tenantName } = useTenant();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  useEffect(() => {
    async function loadClients() {
      setIsLoadingClients(true);
      const result = await listClients({ pageSize: 100 });
      if (result.success) {
        setClients(result.data.clients);
      }
      setIsLoadingClients(false);
    }
    loadClients();
  }, []);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.doc_number.includes(clientSearch)
  );

  const handleSubmit = async (data: PolicyFormData) => {
    if (!selectedClientId) {
      setError('Debes seleccionar un cliente');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createPolicy({
      ...data,
      client_id: selectedClientId
    });

    if (result.success) {
      router.push(`/polizas/${result.data.id}`);
    } else {
      setError(result.error.message);
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/polizas">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Nueva Póliza</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selección de Cliente */}
        {!selectedClientId && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Seleccionar Cliente</CardTitle>
              <CardDescription>
                Primero selecciona el cliente para esta póliza
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nombre o documento..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {isLoadingClients ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No se encontraron clientes
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <p className="font-medium">{client.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {client.doc_number} • {client.email || 'Sin email'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cliente Seleccionado */}
        {selectedClient && (
          <Card className="mb-6 border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente seleccionado</p>
                  <p className="font-medium">{selectedClient.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedClient.doc_number}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedClientId('')}>
                  Cambiar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulario de Póliza */}
        {selectedClientId && (
          <Card>
            <CardHeader>
              <CardTitle>Datos de la Póliza</CardTitle>
              <CardDescription>
                Ingresa los datos de la nueva póliza
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}
              <PolicyForm
                clientId={selectedClientId}
                onSubmit={handleSubmit}
                onCancel={() => router.push('/polizas')}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function NewPolicyPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Cargando..." />}>
      <NewPolicyContent />
    </Suspense>
  );
}
