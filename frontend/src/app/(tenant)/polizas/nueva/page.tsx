'use client';

// =====================================================
// PÁGINA: Nueva Póliza
// /polizas/nueva (Usando API Routes)
// =====================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm } from '@/components/modules/policies/PolicyForm';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

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
      try {
        const response = await fetch('/api/clientes?pageSize=100');
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        }
      } catch (err) {
        console.error('Error loading clients:', err);
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

    try {
      const response = await fetch('/api/polizas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          client_id: selectedClientId
        })
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/polizas/${result.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al crear la póliza');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Error de conexión');
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/polizas">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Nueva Póliza</span>
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

        <div className="grid gap-6 md:grid-cols-3">
          {/* Client Selection */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Cliente</CardTitle>
              <CardDescription>Busca y selecciona el cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {isLoadingClients ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Cargando clientes...
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setSelectedClientId(client.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedClientId === client.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <p className="font-medium">{client.full_name}</p>
                        <p className="text-sm text-muted-foreground">{client.doc_number}</p>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="text-center py-4 text-muted-foreground">
                        No se encontraron clientes
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Policy Form */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Datos de la Póliza</CardTitle>
              <CardDescription>
                {selectedClient 
                  ? `Póliza para: ${selectedClient.full_name}`
                  : 'Selecciona un cliente primero'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedClientId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un cliente para crear la póliza</p>
                </div>
              ) : (
                <PolicyForm
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  initialData={{ client_id: selectedClientId }}
                />
              )}
            </CardContent>
          </Card>
        </div>
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
