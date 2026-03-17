'use client';

// =====================================================
// PÁGINA: Editar Cliente
// /clientes/[id]/editar
// =====================================================

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/modules/clients/ClientForm';
import { getClientById, updateClient } from '../../actions';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';

// Tipo para el formulario
interface ClientFormData {
  full_name: string;
  doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
  doc_number: string;
  email?: string;
  phone?: string;
  segment: 'individual' | 'empresa' | 'vip';
  agent_id?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const { isLoading: isLoadingTenant, tenantName } = useTenant();
  
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClient() {
      setIsLoading(true);
      const result = await getClientById(clientId);
      
      if (result.success) {
        setClient(result.data);
      } else {
        setError(result.error.message);
      }
      setIsLoading(false);
    }
    
    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  const handleSubmit = async (data: ClientFormData) => {
    setIsSaving(true);
    setError(null);

    const result = await updateClient(clientId, data);

    if (result.success) {
      router.push(`/clientes/${clientId}`);
    } else {
      setError(result.error.message);
      setIsSaving(false);
    }
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando cliente..." />;
  }

  if (error && !client) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link href="/clientes">
            <Button>Volver a Clientes</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href={`/clientes/${clientId}`}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Editar Cliente</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Editar Cliente</CardTitle>
            <CardDescription>
              Modifica los datos del cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
            {client && (
              <ClientForm
                client={client}
                onSubmit={handleSubmit}
                onCancel={() => router.push(`/clientes/${clientId}`)}
                isLoading={isSaving}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
