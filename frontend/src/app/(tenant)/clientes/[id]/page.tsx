'use client';

// =====================================================
// PÁGINA: Detalle de Cliente (Vista 360°)
// /clientes/[id]
// Usa Supabase client directamente (evita API Routes con problemas de proxy)
// =====================================================

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Client360View } from '@/components/modules/clients/Client360View';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClient() {
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
    }
    
    if (clientId && tenantId) {
      loadClient();
    }
  }, [clientId, tenantId]);

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando cliente..." />;
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error || 'Cliente no encontrado'}</p>
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
              <Link href="/clientes">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold">{client.full_name}</h1>
                <p className="text-sm text-muted-foreground">{client.doc_number}</p>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{tenantName}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Client360View client={client} />
      </main>
    </div>
  );
}
