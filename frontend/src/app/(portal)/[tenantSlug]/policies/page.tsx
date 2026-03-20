'use client';

// =====================================================
// PÁGINA: Pólizas del Portal
// Módulo 07: Portal del Cliente
// Lista de pólizas activas del cliente
// =====================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { usePortal } from '@/lib/context/PortalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPortalDate, formatPortalCurrency, daysUntil } from '@/lib/validations/portal';
import {
  FileText,
  Download,
  Shield,
  Calendar,
  DollarSign,
  Building2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

// Tipos
interface Policy {
  id: string;
  policy_number: string;
  insurer: string;
  line: string;
  status: string;
  premium: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  document_url: string | null;
}

// Labels para líneas de seguro
const POLICY_LINE_LABELS: Record<string, string> = {
  vida: 'Vida',
  auto: 'Auto',
  salud: 'Salud',
  hogar: 'Hogar',
  soat: 'SOAT',
  otro: 'Otro'
};

// Colores para estados
const POLICY_STATUS_COLORS: Record<string, string> = {
  activa: 'bg-green-100 text-green-800 border-green-300',
  vencida: 'bg-red-100 text-red-800 border-red-300',
  cancelada: 'bg-gray-100 text-gray-800 border-gray-300',
  renovacion: 'bg-blue-100 text-blue-800 border-blue-300',
  cotizacion: 'bg-yellow-100 text-yellow-800 border-yellow-300'
};

const POLICY_STATUS_LABELS: Record<string, string> = {
  activa: 'Activa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
  renovacion: 'En Renovación',
  cotizacion: 'Cotización'
};

// Iconos para líneas de seguro
const POLICY_LINE_ICONS: Record<string, React.ReactNode> = {
  vida: <Shield className="h-5 w-5" />,
  auto: <Building2 className="h-5 w-5" />,
  salud: <Shield className="h-5 w-5" />,
  hogar: <Building2 className="h-5 w-5" />,
  soat: <FileText className="h-5 w-5" />,
  otro: <FileText className="h-5 w-5" />
};

export default function PortalPoliciesPage() {
  const params = useParams();
  const tenantSlug = params?.tenantSlug as string;
  const { client } = usePortal();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Cargar pólizas
  useEffect(() => {
    async function loadPolicies() {
      if (!client.client_id || !client.tenant_id) return;

      try {
        const { data, error } = await supabase
          .from('policies')
          .select('id, policy_number, insurer, line, status, premium, currency, start_date, end_date, document_url')
          .eq('tenant_id', client.tenant_id)
          .eq('client_id', client.client_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPolicies(data || []);
      } catch (e) {
        console.error('Error loading policies:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadPolicies();
  }, [supabase, client.client_id, client.tenant_id]);

  // Descargar documento con signed URL
  const handleDownload = useCallback(async (policy: Policy) => {
    if (!policy.document_url) return;

    setDownloadingId(policy.id);

    try {
      // Extraer el path del documento desde la URL
      const urlParts = policy.document_url.split('/');
      const bucketAndPath = urlParts.slice(urlParts.indexOf('policy-documents')).join('/');
      const filePath = bucketAndPath.replace('policy-documents/', '');

      // Generar signed URL con expiración de 1 hora
      const { data, error } = await supabase.storage
        .from('policy-documents')
        .createSignedUrl(filePath, 3600); // 1 hora

      if (error) throw error;

      // Abrir en nueva pestaña
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (e) {
      console.error('Error downloading document:', e);
      alert('Error al descargar el documento. Intenta de nuevo.');
    } finally {
      setDownloadingId(null);
    }
  }, [supabase]);

  // Agrupar pólizas por estado
  const activePolicies = policies.filter(p => p.status === 'activa');
  const otherPolicies = policies.filter(p => p.status !== 'activa');

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6" data-testid="portal-policies-loading">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="portal-policies">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pólizas</h1>
        <p className="text-muted-foreground">
          Consulta el detalle y documentos de tus pólizas de seguros
        </p>
      </div>

      {/* Sin pólizas */}
      {policies.length === 0 && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No tienes pólizas registradas</h3>
            <p className="text-muted-foreground mt-1">
              Contacta a tu agente para contratar tu primer seguro.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pólizas activas */}
      {activePolicies.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Pólizas Activas ({activePolicies.length})
          </h2>
          <div className="grid gap-4">
            {activePolicies.map(policy => (
              <PolicyCard 
                key={policy.id} 
                policy={policy} 
                onDownload={handleDownload}
                isDownloading={downloadingId === policy.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Otras pólizas */}
      {otherPolicies.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-500">
            Otras Pólizas ({otherPolicies.length})
          </h2>
          <div className="grid gap-4">
            {otherPolicies.map(policy => (
              <PolicyCard 
                key={policy.id} 
                policy={policy} 
                onDownload={handleDownload}
                isDownloading={downloadingId === policy.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// COMPONENTE: PolicyCard
// =====================================================

interface PolicyCardProps {
  policy: Policy;
  onDownload: (policy: Policy) => void;
  isDownloading: boolean;
}

function PolicyCard({ policy, onDownload, isDownloading }: PolicyCardProps) {
  const daysToExpiry = policy.end_date ? daysUntil(policy.end_date) : null;
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry > 0;

  return (
    <Card 
      className={`hover:shadow-md transition-shadow ${policy.status !== 'activa' ? 'opacity-75' : ''}`}
      data-testid={`policy-card-${policy.id}`}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Icono */}
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            policy.status === 'activa' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
          }`}>
            {POLICY_LINE_ICONS[policy.line] || <FileText className="h-6 w-6" />}
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                {POLICY_LINE_LABELS[policy.line] || policy.line}
              </h3>
              <Badge 
                variant="outline" 
                className={POLICY_STATUS_COLORS[policy.status] || ''}
              >
                {POLICY_STATUS_LABELS[policy.status] || policy.status}
              </Badge>
              {isExpiringSoon && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                  Vence en {daysToExpiry} días
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              Póliza N° {policy.policy_number}
            </p>

            {/* Detalles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Aseguradora</p>
                  <p className="font-medium">{policy.insurer}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Prima</p>
                  <p className="font-medium">
                    {formatPortalCurrency(policy.premium, policy.currency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Vigencia</p>
                  <p className="font-medium">
                    {formatPortalDate(policy.start_date)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Vencimiento</p>
                  <p className={`font-medium ${isExpiringSoon ? 'text-orange-600' : ''}`}>
                    {formatPortalDate(policy.end_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex lg:flex-col gap-2 lg:items-end">
            {policy.document_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(policy)}
                disabled={isDownloading}
                data-testid={`download-policy-${policy.id}`}
              >
                {isDownloading ? (
                  <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Descargar
              </Button>
            )}
          </div>
        </div>

        {/* Alerta de vencimiento */}
        {isExpiringSoon && policy.status === 'activa' && (
          <div className="mt-4 p-3 bg-orange-50 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">
                Esta póliza vence pronto
              </p>
              <p className="text-xs text-orange-700">
                Contacta a tu agente para renovarla y mantener tu cobertura.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
