'use client';

// =====================================================
// PÁGINA: Editar Cliente
// /clientes/[id]/editar
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/modules/clients/ClientForm';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

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
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClient = useCallback(async () => {
    if (!tenantId || !clientId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (fetchError) {
        console.error('Error fetching client:', fetchError);
        setError(fetchError.message || 'Error al cargar el cliente');
      } else {
        setClient(data as Client);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    }
    setIsLoading(false);
  }, [clientId, tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId && clientId) {
      loadClient();
    }
  }, [isLoadingTenant, tenantId, clientId, loadClient]);

  const handleSubmit = async (data: ClientFormData) => {
    if (!tenantId || !clientId) return;
    
    setIsSaving(true);
    setError(null);

    try {
      const supabase = getBrowserClient();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('clients')
        .update({
          full_name: data.full_name,
          doc_type: data.doc_type,
          doc_number: data.doc_number,
          email: data.email || null,
          phone: data.phone || null,
          segment: data.segment,
          agent_id: data.agent_id || null,
          tags: data.tags || [],
          metadata: data.metadata || {},
        })
        .eq('id', clientId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Error updating client:', updateError);
        if (updateError.code === '23505') {
          setError('Ya existe un cliente con este número de documento.');
        } else {
          setError(updateError.message || 'Error al actualizar');
        }
        setIsSaving(false);
        return;
      }

      router.push(`/clientes/${clientId}`);
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
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
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href={`/clientes/${clientId}`}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold">Editar Cliente</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{tenantName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && client && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Editar Cliente</CardTitle>
            <CardDescription>Actualiza la información del cliente</CardDescription>
          </CardHeader>
          <CardContent>
            {client && (
              <ClientForm
                onSubmit={handleSubmit}
                isLoading={isSaving}
                client={client}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
