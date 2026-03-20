'use client';

// =====================================================
// PÁGINA: Siniestros del Portal
// Módulo 07: Portal del Cliente
// Lista de siniestros con stepper visual
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { usePortal } from '@/lib/context/PortalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClaimStatusStepper } from '@/components/modules/claims/ClaimStatusStepper';
import { 
  formatPortalDate, 
  formatPortalCurrency 
} from '@/lib/validations/portal';
import {
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  type ClaimStatus
} from '@/lib/validations/claims';
import {
  AlertTriangle,
  Plus,
  Calendar,
  FileText,
  DollarSign,
  ChevronRight,
  MessageSquare
} from 'lucide-react';

// Tipos
interface Claim {
  id: string;
  policy_id: string;
  status: ClaimStatus;
  incident_date: string;
  claimed_amount: number;
  approved_amount: number | null;
  description: string;
  created_at: string;
  policy?: {
    policy_number: string;
    insurer: string;
    line: string;
  };
}

interface ClaimHistory {
  id: string;
  old_status: ClaimStatus | null;
  new_status: ClaimStatus;
  comment: string | null;
  is_internal: boolean;
  changed_at: string;
  changed_by_name?: string;
}

export default function PortalClaimsPage() {
  const params = useParams();
  const tenantSlug = params?.tenantSlug as string;
  const { client } = usePortal();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [claimHistory, setClaimHistory] = useState<Record<string, ClaimHistory[]>>({});

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Cargar siniestros
  useEffect(() => {
    async function loadClaims() {
      if (!client.client_id || !client.tenant_id) return;

      try {
        const { data, error } = await supabase
          .from('claims')
          .select(`
            id,
            policy_id,
            status,
            incident_date,
            claimed_amount,
            approved_amount,
            description,
            created_at,
            policy:policies(policy_number, insurer, line)
          `)
          .eq('tenant_id', client.tenant_id)
          .eq('client_id', client.client_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Transformar data para manejar el policy que viene como array
        const transformedData = (data || []).map((item: Record<string, unknown>) => ({
          ...item,
          policy: Array.isArray(item.policy) ? item.policy[0] : item.policy
        }));
        
        setClaims(transformedData as Claim[]);
      } catch (e) {
        console.error('Error loading claims:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadClaims();
  }, [supabase, client.client_id, client.tenant_id]);

  // Cargar historial cuando se expande un siniestro
  const loadClaimHistory = async (claimId: string) => {
    if (claimHistory[claimId]) return;

    try {
      const { data, error } = await supabase
        .from('claims_history')
        .select(`
          id,
          old_status,
          new_status,
          comment,
          is_internal,
          changed_at,
          changed_by
        `)
        .eq('claim_id', claimId)
        .eq('is_internal', false) // Solo comentarios externos
        .order('changed_at', { ascending: false });

      if (error) throw error;

      setClaimHistory(prev => ({
        ...prev,
        [claimId]: (data || []) as ClaimHistory[]
      }));
    } catch (e) {
      console.error('Error loading claim history:', e);
    }
  };

  // Toggle expandir siniestro
  const toggleExpand = (claimId: string) => {
    if (expandedClaim === claimId) {
      setExpandedClaim(null);
    } else {
      setExpandedClaim(claimId);
      loadClaimHistory(claimId);
    }
  };

  // Separar siniestros activos de cerrados
  const activeClaims = claims.filter(c => !['resolved', 'closed'].includes(c.status));
  const closedClaims = claims.filter(c => ['resolved', 'closed'].includes(c.status));

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6" data-testid="portal-claims-loading">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="portal-claims">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Siniestros</h1>
          <p className="text-muted-foreground">
            Consulta el estado de tus reclamos y reporta nuevos siniestros
          </p>
        </div>
        <Link href={`/${tenantSlug}/claims/new`}>
          <Button data-testid="portal-new-claim-btn">
            <Plus className="h-4 w-4 mr-2" />
            Reportar Siniestro
          </Button>
        </Link>
      </div>

      {/* Sin siniestros */}
      {claims.length === 0 && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No tienes siniestros registrados</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Si necesitas reportar un incidente, usa el botón de arriba.
            </p>
            <Link href={`/${tenantSlug}/claims/new`}>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Reportar mi primer siniestro
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Siniestros en proceso */}
      {activeClaims.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            En Proceso ({activeClaims.length})
          </h2>
          <div className="grid gap-4">
            {activeClaims.map(claim => (
              <ClaimCard 
                key={claim.id} 
                claim={claim}
                isExpanded={expandedClaim === claim.id}
                history={claimHistory[claim.id] || []}
                onToggle={() => toggleExpand(claim.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Siniestros cerrados */}
      {closedClaims.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-500">
            Finalizados ({closedClaims.length})
          </h2>
          <div className="grid gap-4">
            {closedClaims.map(claim => (
              <ClaimCard 
                key={claim.id} 
                claim={claim}
                isExpanded={expandedClaim === claim.id}
                history={claimHistory[claim.id] || []}
                onToggle={() => toggleExpand(claim.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// COMPONENTE: ClaimCard
// =====================================================

interface ClaimCardProps {
  claim: Claim;
  isExpanded: boolean;
  history: ClaimHistory[];
  onToggle: () => void;
}

function ClaimCard({ claim, isExpanded, history, onToggle }: ClaimCardProps) {
  const isClosed = ['resolved', 'closed'].includes(claim.status);

  return (
    <Card 
      className={`transition-all ${isClosed ? 'opacity-75' : ''}`}
      data-testid={`claim-card-${claim.id}`}
    >
      <CardContent className="pt-6">
        {/* Stepper de estado */}
        <div className="mb-6">
          <ClaimStatusStepper currentStatus={claim.status} />
        </div>

        {/* Info principal */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge 
                variant="outline" 
                className={CLAIM_STATUS_COLORS[claim.status]}
              >
                {CLAIM_STATUS_LABELS[claim.status]}
              </Badge>
              {claim.policy && (
                <span className="text-sm text-muted-foreground">
                  Póliza: {claim.policy.policy_number}
                </span>
              )}
            </div>

            {/* Descripción */}
            <p className="text-gray-700 mb-4 line-clamp-2">
              {claim.description}
            </p>

            {/* Detalles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Fecha Incidente</p>
                  <p className="font-medium">{formatPortalDate(claim.incident_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Monto Reclamado</p>
                  <p className="font-medium">{formatPortalCurrency(claim.claimed_amount)}</p>
                </div>
              </div>

              {claim.approved_amount !== null && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-muted-foreground text-xs">Monto Aprobado</p>
                    <p className="font-medium text-green-600">
                      {formatPortalCurrency(claim.approved_amount)}
                    </p>
                  </div>
                </div>
              )}

              {claim.policy && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Aseguradora</p>
                    <p className="font-medium">{claim.policy.insurer}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botón expandir */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="flex items-center gap-1"
            data-testid={`expand-claim-${claim.id}`}
          >
            <MessageSquare className="h-4 w-4" />
            Ver actualizaciones
            <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </Button>
        </div>

        {/* Historial expandible */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Historial de Actualizaciones</h4>
            
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay actualizaciones disponibles aún.
              </p>
            ) : (
              <div className="space-y-4">
                {history.map(entry => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {CLAIM_STATUS_LABELS[entry.new_status]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatPortalDate(entry.changed_at)}
                        </span>
                      </div>
                      {entry.comment && (
                        <p className="text-sm text-gray-600">{entry.comment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
