'use client';

import { useEffect, useState } from 'react';
import { usePortal } from '@/lib/context/PortalContext';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, DollarSign, Building2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Policy {
  id: string;
  policy_number: string;
  product_name: string | null;
  insurer_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  premium: number | null;
  document_url: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  activa: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-red-100 text-red-800',
  vencida: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  cancelada: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  active: 'Activa',
  activa: 'Activa',
  pending: 'Pendiente',
  pendiente: 'Pendiente',
  expired: 'Vencida',
  vencida: 'Vencida',
  cancelled: 'Cancelada',
  cancelada: 'Cancelada',
};

export default function ClientPoliciesPage() {
  const { client } = usePortal();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const fetchPolicies = async () => {
      if (!client?.client_id) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        
        // Usar el RPC con SECURITY DEFINER
        const { data, error } = await supabase
          .rpc('get_client_policies' as any, { p_client_id: client.client_id });

        if (error) {
          console.error('Error fetching policies:', error);
        } else {
          setPolicies(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, [client?.client_id]);

  const handleDownload = async (policy: Policy) => {
    if (!policy.document_url) return;
    
    setDownloading(policy.id);
    try {
      const supabase = createClient();
      
      // Obtener URL firmada para descarga
      const { data, error } = await supabase
        .storage
        .from('policy-documents')
        .createSignedUrl(policy.document_url, 60);

      if (error) {
        console.error('Error getting signed URL:', error);
        alert('Error al descargar el documento');
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al descargar el documento');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis Pólizas</h1>
        <p className="text-muted-foreground">
          Consulta el detalle de todas tus pólizas de seguro
        </p>
      </div>

      {policies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No tienes pólizas</h3>
            <p className="text-muted-foreground text-center mt-1">
              Aún no tienes pólizas registradas en el sistema.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy) => (
            <Card key={policy.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{policy.policy_number}</CardTitle>
                    <CardDescription>{policy.product_name || 'Producto no especificado'}</CardDescription>
                  </div>
                  <Badge className={statusColors[policy.status?.toLowerCase()] || 'bg-gray-100 text-gray-800'}>
                    {statusLabels[policy.status?.toLowerCase()] || policy.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {policy.insurer_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{policy.insurer_name}</span>
                  </div>
                )}
                
                {(policy.start_date || policy.end_date) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {policy.start_date && format(new Date(policy.start_date), 'dd MMM yyyy', { locale: es })}
                      {policy.start_date && policy.end_date && ' - '}
                      {policy.end_date && format(new Date(policy.end_date), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                )}

                {policy.premium && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>Prima: ${policy.premium.toLocaleString('es-CO')}</span>
                  </div>
                )}

                {policy.document_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => handleDownload(policy)}
                    disabled={downloading === policy.id}
                  >
                    {downloading === policy.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Descargar Documento
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
