'use client';

// =====================================================
// PÁGINA: Detalle de Póliza
// /polizas/[id]
// Vista completa con acciones: Editar, Modificar, Renovar, Cancelar
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type Policy,
  type PolicyStatus,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
} from '@/lib/validations/policies';
import {
  ArrowLeft,
  Shield,
  AlertCircle,
  Building,
  Calendar,
  Percent,
  FileText,
  User,
  MoreVertical,
  Edit,
  FilePlus,
  RefreshCw,
  XCircle,
  Eye,
  Trash2,
  Download,
  Loader2,
  DollarSign
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

// Función para formatear números con separadores de miles
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '$0';
  return '$' + value.toLocaleString('es-CO', { maximumFractionDigits: 0 });
};

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

interface PolicyDocument {
  id: string;
  document_type: 'poliza' | 'soporte';
  document_name: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

interface PolicyWithClient extends Policy {
  anexo?: string;
  gastos_expedicion?: number;
  iva?: number;
  total_a_pagar?: number;
  fecha_expedicion?: string;
  policy_type?: 'original' | 'anexo' | 'renovacion';
  parent_policy_id?: string;
  renewed_from_policy_id?: string;
  client?: {
    id: string;
    full_name: string;
    doc_type: string;
    doc_number: string;
    email: string | null;
    phone: string | null;
    segment: string;
  };
  insurance_company?: {
    id: string;
    name: string;
    slug: string;
  };
  insurance_line?: {
    id: string;
    name: string;
    slug: string;
  };
  insurance_group?: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function PolicyDetailPage() {
  const params = useParams();
  const policyId = params.id as string;
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  const router = useRouter();

  const [policy, setPolicy] = useState<PolicyWithClient | null>(null);
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const isValidUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const loadPolicy = useCallback(async () => {
    if (!tenantId || !policyId) return;

    if (!isValidUUID(policyId)) {
      setError('ID de póliza inválido');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      // Cargar póliza con relaciones
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('policies')
        .select(`
          *,
          clients!inner(id, full_name, doc_type, doc_number, email, phone, segment),
          insurance_company:insurance_companies(id, name, slug),
          insurance_line:insurance_lines(id, name, slug),
          insurance_group:insurance_groups(id, name, slug)
        `)
        .eq('id', policyId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) {
        setError(fetchError.message || 'Error al cargar la póliza');
      } else if (data) {
        setPolicy({
          ...data,
          client: data.clients,
          insurance_company: data.insurance_company,
          insurance_line: data.insurance_line,
          insurance_group: data.insurance_group
        } as PolicyWithClient);
      }

      // Cargar documentos de la póliza
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: docsData } = await (supabase as any)
        .from('policy_documents')
        .select('*')
        .eq('policy_id', policyId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (docsData) {
        setDocuments(docsData as PolicyDocument[]);
      }

    } catch {
      setError('Error de conexión');
    }
    setIsLoading(false);
  }, [policyId, tenantId]);

  useEffect(() => {
    if (policyId && tenantId) {
      loadPolicy();
    }
  }, [policyId, tenantId, loadPolicy]);

  const handleCancelPolicy = async () => {
    if (!tenantId || !policy) return;

    setIsCanceling(true);
    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('policies')
        .update({ 
          status: 'cancelada', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', policyId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        setError(updateError.message || 'Error al cancelar la póliza');
      } else {
        setPolicy(prev => prev ? { ...prev, status: 'cancelada' } : null);
        setShowCancelDialog(false);
      }
    } catch {
      setError('Error de conexión');
    }
    setIsCanceling(false);
  };

  const handleViewDocument = async (doc: PolicyDocument) => {
    try {
      const supabase = getBrowserClient();
      
      if (doc.file_url.startsWith('http')) {
        window.open(doc.file_url, '_blank');
      } else {
        const { data } = await supabase.storage
          .from('policy-documents')
          .createSignedUrl(doc.file_url, 3600);

        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
        }
      }
    } catch {
      setError('Error al obtener el documento');
    }
  };

  const getStatusColor = (status: PolicyStatus) => {
    const colors: Record<PolicyStatus, string> = {
      cotizacion: 'bg-gray-100 text-gray-800',
      activa: 'bg-green-100 text-green-800',
      vencida: 'bg-red-100 text-red-800',
      cancelada: 'bg-slate-100 text-slate-800',
      renovacion: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen />;
  }

  if (error || !policy) {
    return (
      <div className="container mx-auto py-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg text-muted-foreground mb-4">{error || 'Póliza no encontrada'}</p>
        <Button asChild>
          <Link href="/polizas">Volver a Pólizas</Link>
        </Button>
      </div>
    );
  }

  const polizaDocs = documents.filter(d => d.document_type === 'poliza');
  const soporteDocs = documents.filter(d => d.document_type === 'soporte');

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Póliza {policy.policy_number}
                {policy.anexo && policy.anexo !== '00' && (
                  <Badge variant="outline" className="ml-2">Anexo {policy.anexo}</Badge>
                )}
              </h1>
              <Badge className={getStatusColor(policy.status as PolicyStatus)}>
                {POLICY_STATUS_LABELS[policy.status as PolicyStatus] || policy.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{tenantName}</p>
          </div>
        </div>

        {/* Menú de Acciones */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Acciones
              <MoreVertical className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href={`/polizas/${policyId}/editar`} className="flex items-center">
                <Edit className="h-4 w-4 mr-2" />
                Editar Póliza {policy.anexo || '00'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => router.push(`/polizas/nueva?modificacion=${policyId}`)}
              className="flex items-center"
            >
              <FilePlus className="h-4 w-4 mr-2" />
              Incluir Modificación (Anexo)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push(`/polizas/nueva?renovacion=${policyId}`)}
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Renovar Póliza
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setShowCancelDialog(true)}
              className="flex items-center text-red-600 focus:text-red-600"
              disabled={policy.status === 'cancelada'}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Póliza
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Estado Actual */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Estado de la Póliza</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-lg font-medium ${getStatusColor(policy.status as PolicyStatus)}`}>
                  {POLICY_STATUS_LABELS[policy.status as PolicyStatus] || policy.status}
                </div>
                {policy.policy_type === 'anexo' && (
                  <Badge variant="outline">Modificación</Badge>
                )}
                {policy.policy_type === 'renovacion' && (
                  <Badge variant="outline">Renovación</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detalles de la Póliza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalles de la Póliza
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Número de Póliza</p>
                  <p className="font-semibold">{policy.policy_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Anexo</p>
                  <p className="font-semibold">{policy.anexo || '00'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aseguradora</p>
                  <p className="font-semibold">{policy.insurance_company?.name || policy.insurer}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grupo</p>
                  <p className="font-semibold">{policy.insurance_line?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ramo</p>
                  <p className="font-semibold">{policy.insurance_group?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comisión</p>
                  <p className="font-semibold">{policy.commission_pct || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vigencia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Vigencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Expedición</p>
                  <p className="font-semibold">{formatDate(policy.fecha_expedicion)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Inicio</p>
                  <p className="font-semibold">{formatDate(policy.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Vencimiento</p>
                  <p className="font-semibold">{formatDate(policy.end_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Valores de la Póliza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Valores de la Póliza
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Prima</p>
                  <p className="font-semibold text-lg">{formatCurrency(policy.premium)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Gastos Exp.</p>
                  <p className="font-semibold text-lg">{formatCurrency(policy.gastos_expedicion)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">IVA</p>
                  <p className="font-semibold text-lg">{formatCurrency(policy.iva)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg col-span-2 md:col-span-2">
                  <p className="text-xs text-blue-600">Total a Pagar</p>
                  <p className="font-bold text-xl text-blue-700">{formatCurrency(policy.total_a_pagar)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos
              </CardTitle>
              <CardDescription>Documentos adjuntos de la póliza</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Documentos de Póliza */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-slate-700">Documentos de Póliza</h4>
                  {polizaDocs.length > 0 ? (
                    <div className="space-y-2">
                      {polizaDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <span className="text-sm truncate">{doc.file_name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center bg-slate-50 rounded-lg">
                      No hay documentos de póliza
                    </p>
                  )}
                </div>

                {/* Documentos de Soporte */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-slate-700">Documentos de Soporte</h4>
                  {soporteDocs.length > 0 ? (
                    <div className="space-y-2">
                      {soporteDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-sm truncate">{doc.file_name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center bg-slate-50 rounded-lg">
                      No hay documentos de soporte
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cliente */}
          {policy.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold">{policy.client.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {policy.client.doc_type.toUpperCase()}: {policy.client.doc_number}
                  </p>
                </div>
                {policy.client.email && (
                  <p className="text-sm">{policy.client.email}</p>
                )}
                {policy.client.phone && (
                  <p className="text-sm">{policy.client.phone}</p>
                )}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/clientes/${policy.client.id}`}>
                    Ver Cliente
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Resumen Rápido */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Prima</span>
                <span className="font-medium">{formatCurrency(policy.premium)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Gastos</span>
                <span className="font-medium">{formatCurrency(policy.gastos_expedicion)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">IVA</span>
                <span className="font-medium">{formatCurrency(policy.iva)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-primary">{formatCurrency(policy.total_a_pagar)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-sm text-muted-foreground">Comisión ({policy.commission_pct}%)</span>
                <span className="font-medium text-green-600">
                  {formatCurrency((policy.premium || 0) * (policy.commission_pct || 0) / 100)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de Cancelación */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Póliza</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar la póliza <strong>{policy.policy_number}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              No, mantener
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelPolicy}
              disabled={isCanceling}
            >
              {isCanceling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Sí, cancelar póliza'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
