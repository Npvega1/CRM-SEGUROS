'use client';

// =====================================================
// PÁGINA: Nuevo Cliente
// /clientes/nuevo
// Usa Supabase client directamente (evita API Routes con problemas de proxy)
// =====================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/modules/clients/ClientForm';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

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

export default function NewClientPage() {
  const router = useRouter();
  const { isLoading: isLoadingTenant, tenantName } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    setError(null);

    // Re-obtener el contexto actual para asegurar que tenemos la sesión más reciente
    const supabase = getBrowserClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      setError('No hay sesión activa. Por favor, inicia sesión de nuevo.');
      setIsLoading(false);
      return;
    }
    
    const currentTenantId = currentUser.app_metadata?.tenant_id;
    if (!currentTenantId) {
      setError('No se pudo obtener la información del tenant.');
      setIsLoading(false);
      return;
    }

    try {
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          tenant_id: currentTenantId,
          full_name: data.full_name,
          doc_type: data.doc_type,
          doc_number: data.doc_number,
          email: data.email || null,
          phone: data.phone || null,
          segment: data.segment,
          agent_id: data.agent_id || currentUser.id,
          tags: data.tags || [],
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating client:', insertError);
        if (insertError.code === '23505') {
          setError('Ya existe un cliente con este número de documento.');
        } else {
          setError(insertError.message || 'Error al crear cliente');
        }
        setIsLoading(false);
        return;
      }

      router.push(`/clientes/${newClient.id}`);
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión. Por favor, intenta de nuevo.');
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/clientes">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Nuevo Cliente</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Cliente</CardTitle>
            <CardDescription>
              Ingresa los datos del nuevo cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}
            <ClientForm
              onSubmit={handleSubmit}
              onCancel={() => router.push('/clientes')}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
