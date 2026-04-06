'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClientForm } from '@/components/modules/clients/ClientForm';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function EditClientPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClient() {
      try {
        const supabase = createClient();
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
    <div className="w-full py-6">
      <ClientForm
        initialData={client}
        tenantId={client.tenant_id}
        agentId={client.agent_id}
      />
    </div>
  );
}
