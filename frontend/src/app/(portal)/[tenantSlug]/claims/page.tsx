'use client';

import { useEffect, useState } from 'react';
import { usePortal } from '@/lib/context/PortalContext';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, DollarSign, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Claim {
  id: string;
  claim_number: string;
  policy_number: string | null;
  product_name: string | null;
  claim_date: string | null;
  description: string | null;
  status: string;
  amount: number | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  aprobado: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  rechazado: 'bg-red-100 text-red-800',
  paid: 'bg-purple-100 text-purple-800',
  pagado: 'bg-purple-100 text-purple-800',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  pendiente: 'Pendiente',
  in_review: 'En Revisión',
  en_revision: 'En Revisión',
  approved: 'Aprobado',
  aprobado: 'Aprobado',
  rejected: 'Rechazado',
  rechazado: 'Rechazado',
  paid: 'Pagado',
  pagado: 'Pagado',
};

export default function ClientClaimsPage() {
  const { client } = usePortal();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClaims = async () => {
      if (!client?.client_id) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        
        // Usar el RPC con SECURITY DEFINER
        const { data, error } = await supabase
          .rpc('get_client_claims', { p_client_id: client.client_id });

        if (error) {
          console.error('Error fetching claims:', error);
        } else {
          setClaims(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [client?.client_id]);

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
        <h1 className="text-2xl font-bold tracking-tight">Mis Siniestros</h1>
        <p className="text-muted-foreground">
          Consulta el estado de tus reclamaciones y siniestros
        </p>
      </div>

      {claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No tienes siniestros</h3>
            <p className="text-muted-foreground text-center mt-1">
              No tienes siniestros reportados en el sistema.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {claims.map((claim) => (
            <Card key={claim.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{claim.claim_number}</CardTitle>
                    <CardDescription>
                      {claim.policy_number ? `Póliza: ${claim.policy_number}` : 'Sin póliza asociada'}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[claim.status?.toLowerCase()] || 'bg-gray-100 text-gray-800'}>
                    {statusLabels[claim.status?.toLowerCase()] || claim.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {claim.product_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{claim.product_name}</span>
                  </div>
                )}
                
                {claim.claim_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Fecha: {format(new Date(claim.claim_date), 'dd MMM yyyy', { locale: es })}</span>
                  </div>
                )}

                {claim.amount && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>Monto: ${claim.amount.toLocaleString('es-CO')}</span>
                  </div>
                )}

                {claim.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {claim.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
