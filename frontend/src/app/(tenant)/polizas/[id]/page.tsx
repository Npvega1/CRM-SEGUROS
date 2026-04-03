'use client';

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
} from '@/lib/validations/policies';
import {
  ArrowLeft,
  Shield,
  AlertCircle,
  Calendar,
  FileText,
  User,
  Users,
  MoreVertical,
  Edit,
  FilePlus,
  RefreshCw,
  XCircle,
  Eye,
  Loader2,
  DollarSign,
  Upload,
  Trash2,
  File,
  MessageSquare,
  Layers
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '$0';
  const absValue = Math.abs(value);
  const formatted = '$' + absValue.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  return value < 0 ? `-${formatted}` : formatted;
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

interface RelatedAnexo {
  id: string;
  anexo: string;
  premium: number;
  total_a_pagar: number;
  gastos_expedicion: number;
  iva: number;
  status: string;
  fecha_expedicion: string | null;
  created_at: string;
}

interface PolicyWithClient extends Policy {
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
  const [relatedAnexos, setRelatedAnexos] = useState<RelatedAnexo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isUploadingPoliza, setIsUploadingPoliza] = useState(false);
  const [isUploadingSoporte, setIsUploadingSoporte] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [remisionData, setRemisionData] = useState<{estado: string; numero_remision: string | null} | null>(null);
  const [carteraData, setCarteraData] = useState<{estado: string} | null>(null);

  const isValidUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const loadPolicy = useCallback(async () => {
    if (!tenantId || !policyId) return;

    if (!isValidUUID(policyId)) {
      setError('ID de poliza invalido');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

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
        setError(fetchError.message || 'Error al cargar la poliza');
      } else if (data) {
        setPolicy({
          ...data,
          client: data.clients,
          insurance_company: data.insurance_company,
          insurance_line: data.insurance_line,
          insurance_group: data.insurance_group
        } as PolicyWithClient);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: anexosData } = await (supabase as any)
          .from('policies')
          .select('id, anexo, premium, total_a_pagar, gastos_expedicion, iva, status, fecha_expedicion, created_at')
          .eq('policy_number', data.policy_number)
          .eq('tenant_id', tenantId)
          .neq('id', policyId)
          .order('anexo', { ascending: true });

        if (anexosData) {
          setRelatedAnexos(anexosData as RelatedAnexo[]);
        }
      }

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

      const { data: remData } = await (supabase as any)
        .from('remisiones')
        .select('estado, numero_remision')
        .eq('policy_id', policyId)
        .single();

      if (remData) {
        setRemisionData(remData as {estado: string; numero_remision: string | null});
      }

      const { data: cartData } = await (supabase as any)
        .from('cartera')
        .select('estado')
        .eq('policy_id', policyId)
        .single();

      if (cartData) {
        setCarteraData(cartData as {estado: string});
      }

    } catch {
      setError('Error de conexion');
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
        setError(updateError.message || 'Error al cancelar la poliza');
      } else {
        setPolicy(prev => prev ? { ...prev, status: 'cancelada' } : null);
        setShowCancelDialog(false);
      }
    } catch {
      setError('Error de conexion');
    }
    setIsCanceling(false);
  };

  const handleUploadDocument = async (file: globalThis.File, documentType: 'poliza' | 'soporte') => {
    if (!tenantId || !policyId) return;

    const setUploading = documentType === 'poliza' ? setIsUploadingPoliza : setIsUploadingSoporte;
    setUploading(true);

    try {
      const supabase = getBrowserClient();

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${tenantId}/policies/${policyId}/${documentType}/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        setError(`Error al subir: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newDoc, error: insertError } = await (supabase as any)
        .from('policy_documents')
        .insert({
          tenant_id: tenantId,
          policy_id: policyId,
          document_type: documentType,
          document_name: documentType === 'poliza' ? 'Documento de Poliza' : file.name.split('.')[0],
          file_url: path,
          file_name: file.name
        })
        .select()
        .single();

      if (insertError) {
        setError(`Error al guardar: ${insertError.message}`);
      } else if (newDoc) {
        setDocuments(prev => [newDoc as PolicyDocument, ...prev]);
      }
    } catch {
      setError('Error al subir documento');
    }
    setUploading(false);
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

  const handleDeleteDocument = async () => {
    if (!deleteDocId || !tenantId) return;

    setIsDeletingDoc(true);
    try {
      const supabase = getBrowserClient();
      const docToDelete = documents.find(d => d.id === deleteDocId);

      if (docToDelete && !docToDelete.file_url.startsWith('http')) {
        await supabase.storage
          .from('policy-documents')
          .remove([docToDelete.file_url]);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('policy_documents')
        .delete()
        .eq('id', deleteDocId)
        .eq('tenant_id', tenantId);

      if (deleteError) {
        setError(`Error al eliminar: ${deleteError.message}`);
      } else {
        setDocuments(prev => prev.filter(d => d.id !== deleteDocId));
      }
    } catch {
      setError('Error al eliminar documento');
    }
    setIsDeletingDoc(false);
    setDeleteDocId(null);
  };

  const getStatusColor = (status: PolicyStatus) => {
    const colors: Record<string, string> = {
      cotizacion: 'bg-gray-100 text-gray-800',
      activa: 'bg-green-100 text-green-800',
      vencida: 'bg-red-100 text-red-800',
      cancelada: 'bg-slate-100 text-slate-800',
      renovacion: 'bg-yellow-100 text-yellow-800',
      verificacion: 'bg-amber-100 text-amber-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen />;
  }

  if (error || !policy) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg text-red-600">{error || 'Poliza no encontrada'}</p>
        <Button className="mt-4" onClick={() => router.push('/polizas')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Polizas
        </Button>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policyAny = policy as any;
  const polizaDocs = documents.filter(d => d.document_type === 'poliza');
  const soporteDocs = documents.filter(d => d.document_type === 'soporte');
  const calculatedTotal = (policy.premium || 0) + (policyAny.gastos_expedicion || 0) + (policyAny.iva || 0);
  const displayTotal = policyAny.total_a_pagar || calculatedTotal;

  const basePrima = policy.premium || 0;
  const baseGastos = policyAny.gastos_expedicion || 0;
  const baseIva = policyAny.iva || 0;
  const baseTotal = policyAny.total_a_pagar || calculatedTotal;

  const anexosPrima = relatedAnexos.reduce((sum, anexo) => sum + (anexo.premium || 0), 0);
  const anexosGastos = relatedAnexos.reduce((sum, anexo) => sum + (anexo.gastos_expedicion || 0), 0);
  const anexosIva = relatedAnexos.reduce((sum, anexo) => sum + (anexo.iva || 0), 0);
  const anexosTotal = relatedAnexos.reduce((sum, anexo) => sum + (anexo.total_a_pagar || anexo.premium || 0), 0);

  const primaConsolidada = basePrima + anexosPrima;
  const gastosConsolidados = baseGastos + anexosGastos;
  const ivaConsolidado = baseIva + anexosIva;
  const totalConsolidado = baseTotal + anexosTotal;
  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="policy-detail-page">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg" variant="ghost">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Poliza {policy.policy_number}</h1>
              {policyAny.anexo && policyAny.anexo !== '00' && (
                <Badge variant="outline">Anexo {policyAny.anexo}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusColor(policy.status as PolicyStatus)}>
                {POLICY_STATUS_LABELS[policy.status as PolicyStatus] || policy.status}
              </Badge>
              {policy.status === 'activa' && (
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-gray-300">|</span>
                  <Badge variant="outline" className={remisionData?.estado === 'remisionada' ? 'bg-green-50 text-green-700 border-green-400 px-3 py-1' : 'bg-gray-50 text-gray-400 border-gray-300 px-3 py-1'}>
                    {remisionData?.estado === 'remisionada' ? 'Remisionada' : 'Sin remisionar'}
                  </Badge>
                  <Badge variant="outline" className={carteraData?.estado === 'pagada' ? 'bg-green-50 text-green-700 border-green-400 px-3 py-1' : carteraData?.estado === 'abono' ? 'bg-blue-50 text-blue-700 border-blue-400 px-3 py-1' : 'bg-gray-50 text-gray-400 border-gray-300 px-3 py-1'}>
                    {carteraData?.estado === 'pagada' ? 'Pagada' : carteraData?.estado === 'abono' ? 'Abono parcial' : 'Sin recaudo'}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreVertical className="w-5 h-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/polizas/${policyId}/editar`)} className="cursor-pointer">
              <Edit className="w-4 h-4 mr-2" />
              Editar Poliza
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/polizas/modificar?poliza=${policyId}`)} className="cursor-pointer">
              <FilePlus className="w-4 h-4 mr-2" />
              Incluir Modificacion
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/polizas/nueva?renovacion=${policyId}`)} className="cursor-pointer">
              <RefreshCw className="w-4 h-4 mr-2" />
              Renovar Poliza
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCancelDialog(true)} className="cursor-pointer text-red-600" disabled={policy.status === 'cancelada'}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar Poliza
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Detalles */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Detalles de la Poliza</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><p className="text-sm text-muted-foreground">Numero</p><p className="font-medium">{policy.policy_number}</p></div>
                <div><p className="text-sm text-muted-foreground">Anexo</p><p className="font-medium">{policyAny.anexo || '00'}</p></div>
                <div><p className="text-sm text-muted-foreground">Aseguradora</p><p className="font-medium">{policy.insurance_company?.name || policy.insurer}</p></div>
                <div><p className="text-sm text-muted-foreground">Ramo</p><p className="font-medium">{policy.insurance_line?.name || '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Grupo</p><p className="font-medium">{policy.insurance_group?.name || '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Tipo Movimiento</p><p className="font-medium capitalize">{policyAny.tipo_movimiento || '-'}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Vigencia */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />Vigencia</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-sm text-muted-foreground">Expedicion</p><p className="font-medium">{formatDate(policyAny.fecha_expedicion)}</p></div>
                <div><p className="text-sm text-muted-foreground">Inicio</p><p className="font-medium">{formatDate(policy.start_date)}</p></div>
                <div><p className="text-sm text-muted-foreground">Vencimiento</p><p className="font-medium">{formatDate(policy.end_date)}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Tomador */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Tomador</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><p className="text-sm text-muted-foreground">Nombre / Razon Social</p><p className="font-medium">{policyAny.tomador_nombre || policy.client?.full_name || '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Tipo Identificacion</p><p className="font-medium capitalize">{(policyAny.tomador_tipo_identificacion || policy.client?.doc_type || '-').replace(/_/g, ' ')}</p></div>
                <div><p className="text-sm text-muted-foreground">Numero Identificacion</p><p className="font-medium">{policyAny.tomador_numero_identificacion || policy.client?.doc_number || '-'}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Asegurado (solo si es diferente al tomador) */}
          {policyAny.asegurado_diferente && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Asegurado</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div><p className="text-sm text-muted-foreground">Nombre</p><p className="font-medium">{policyAny.asegurado_nombre || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Tipo Identificacion</p><p className="font-medium capitalize">{(policyAny.asegurado_tipo_identificacion || '-').replace(/_/g, ' ')}</p></div>
                  <div><p className="text-sm text-muted-foreground">Numero Identificacion</p><p className="font-medium">{policyAny.asegurado_numero_identificacion || '-'}</p></div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Valores */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" />Valores de la Poliza {policyAny.anexo && policyAny.anexo !== '00' && `(Anexo ${policyAny.anexo})`}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div><p className="text-sm text-muted-foreground">Valor Asegurado</p><p className="font-medium text-lg">{formatCurrency(policyAny.valor_asegurado)}</p></div>
                <div><p className="text-sm text-muted-foreground">Prima Neta</p><p className="font-medium text-lg">{formatCurrency(policy.premium)}</p></div>
                <div><p className="text-sm text-muted-foreground">Gastos Exp.</p><p className="font-medium text-lg">{formatCurrency(policyAny.gastos_expedicion)}</p></div>
                <div><p className="text-sm text-muted-foreground">IVA</p><p className="font-medium text-lg">{formatCurrency(policyAny.iva)}</p></div>
                <div><p className="text-sm text-muted-foreground">Total a Pagar</p><p className="font-medium text-lg text-emerald-600">{formatCurrency(displayTotal)}</p></div>
                <div><p className="text-sm text-muted-foreground">Comision</p><p className="font-medium text-lg">{policyAny.commission_pct || 0}%</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />Notas y Comentarios</CardTitle></CardHeader>
            <CardContent>
              {policyAny.notas ? (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{policyAny.notas}</p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground">No hay comentarios registrados para esta poliza.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Documentos</CardTitle>
              <CardDescription>Documentos adjuntos de la poliza</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Documentos de Poliza</h4>
                  <Badge variant="outline">{polizaDocs.length} / 5</Badge>
                </div>
                {polizaDocs.length < 5 && (
                  <div className="mb-3">
                    <label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDocument(file, 'poliza');
                          e.target.value = '';
                        }}
                        className="hidden"
                        disabled={isUploadingPoliza}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          {isUploadingPoliza ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          {isUploadingPoliza ? 'Subiendo...' : 'Subir documento'}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
                {polizaDocs.length > 0 ? (
                  <div className="space-y-2">
                    {polizaDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{doc.file_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDocument(doc)} className="h-8 w-8 p-0"><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteDocId(doc.id)} className="h-8 w-8 p-0 hover:bg-red-100"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay documentos de poliza</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Documentos de Soporte</h4>
                  <Badge variant="outline">{soporteDocs.length} / 8</Badge>
                </div>
                {soporteDocs.length < 8 && (
                  <div className="mb-3">
                    <label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDocument(file, 'soporte');
                          e.target.value = '';
                        }}
                        className="hidden"
                        disabled={isUploadingSoporte}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          {isUploadingSoporte ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          {isUploadingSoporte ? 'Subiendo...' : 'Subir documento'}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
                {soporteDocs.length > 0 ? (
                  <div className="space-y-2">
                    {soporteDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{doc.file_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDocument(doc)} className="h-8 w-8 p-0"><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteDocId(doc.id)} className="h-8 w-8 p-0 hover:bg-red-100"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay documentos de soporte</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {policy.client && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Cliente</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="font-semibold text-lg">{policy.client.full_name}</p>
                  <p className="text-sm text-muted-foreground">{policy.client.doc_type.toUpperCase()}: {policy.client.doc_number}</p>
                  {policy.client.email && (<p className="text-sm">{policy.client.email}</p>)}
                  {policy.client.phone && (<p className="text-sm">{policy.client.phone}</p>)}
                  <Button variant="outline" className="w-full" onClick={() => router.push(`/clientes/${policy.client?.id}`)}>Ver Cliente</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Resumen {policyAny.anexo && policyAny.anexo !== '00' && `(Anexo ${policyAny.anexo})`}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Prima</span><span className="font-medium">{formatCurrency(policy.premium)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Gastos</span><span className="font-medium">{formatCurrency(policyAny.gastos_expedicion)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">IVA</span><span className="font-medium">{formatCurrency(policyAny.iva)}</span></div>
                <hr />
                <div className="flex justify-between"><span className="font-semibold">Total</span><span className="font-bold">{formatCurrency(displayTotal)}</span></div>
              </div>
            </CardContent>
          </Card>

          {relatedAnexos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" />Anexos Relacionados</CardTitle>
                <CardDescription>Modificaciones de esta poliza</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">Poliza Base (Anexo {policyAny.anexo || '00'})</p>
                      <p className="text-xs text-muted-foreground">Este documento</p>
                    </div>
                    <p className="font-medium">{formatCurrency(basePrima)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Prima</p>
                </div>

                {relatedAnexos.map((anexo) => (
                  <div key={anexo.id} className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/polizas/${anexo.id}`)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">Anexo {anexo.anexo}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(anexo.fecha_expedicion || anexo.created_at)}</p>
                      </div>
                      <p className="font-medium">{formatCurrency(anexo.premium)}</p>
                    </div>
                    <Badge className={`mt-1 text-xs ${getStatusColor(anexo.status as PolicyStatus)}`}>
                      {POLICY_STATUS_LABELS[anexo.status as PolicyStatus] || anexo.status}
                    </Badge>
                  </div>
                ))}

                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Prima Consolidada</span><span className="font-medium">{formatCurrency(primaConsolidada)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gastos Consolidados</span><span className="font-medium">{formatCurrency(gastosConsolidados)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA Consolidado</span><span className="font-medium">{formatCurrency(ivaConsolidado)}</span></div>
                  <hr />
                  <div className="flex justify-between font-semibold"><span>Total Consolidado</span><span>{formatCurrency(totalConsolidado)}</span></div>
                  <p className="text-xs text-muted-foreground text-center mt-1">Este documento + {relatedAnexos.length} anexo(s)</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog Cancelar */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Poliza</DialogTitle>
            <DialogDescription>
              Estas seguro de que deseas cancelar la poliza <strong>{policy.policy_number}</strong>? Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>No, mantener</Button>
            <Button variant="destructive" onClick={handleCancelPolicy} disabled={isCanceling}>
              {isCanceling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelando...</> : 'Si, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar Doc */}
      <Dialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Documento</DialogTitle>
            <DialogDescription>Estas seguro de que deseas eliminar este documento? Esta accion no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDocId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteDocument} disabled={isDeletingDoc}>
              {isDeletingDoc ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eliminando...</> : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
