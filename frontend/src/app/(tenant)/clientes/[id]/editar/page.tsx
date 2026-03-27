'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClientForm } from '@/components/modules/clients/ClientForm';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

interface Client {
  id: string;
  full_name: string;
  doc_type: string;
  doc_number: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  segment: string;
  tenant_id: string;
  agent_id: string;
  allied_agent_id: string | null;
}

export default function EditClientPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClient() {
      try {
        const supabase = createBrowserClient();
        
        const { data, error: fetchError } = await (supabase as any)
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single();

        if (fetchError) throw fetchError;
        
        setClient(data);
      } catch (err) {
        console.error('Error loading client:', err);
        setError('Error al cargar el cliente');
      } finally {
        setLoading(false);
      }
    }

    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-500">{error || 'Cliente no encontrado'}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6">
      <ClientForm
        initialData={{
          id: client.id,
          full_name: client.full_name,
          doc_type: client.doc_type as any,
          doc_number: client.doc_number,
          email: client.email || '',
          phone: client.phone || '',
          address: client.address || '',
          segment: client.segment as any,
          allied_agent_id: client.allied_agent_id,
        }}
        tenantId={client.tenant_id}
        agentId={client.agent_id}
      />
    </div>
  );
}
