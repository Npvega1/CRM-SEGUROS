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
  MessageSquare
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

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
  const [isUploadingPoliza, setIsUploadingPoliza] = useState(false);
  const [isUploadingSoporte, setIsUploadingSoporte] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

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

  const handleUploadDocument = async (file: File, documentType: 'poliza' | 'soporte') => {
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
          document_name: documentType === 'poliza' ? 'Documento de Póliza' : file.name.split('.')[0],
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
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <p className="text-lg text-red-600 mb-4">{error || 'Póliza no encontrada'}</p>
        <Link href="/polizas">
          <Button variant="outline">Volver a Pólizas</Button>
        </Link>
      </div>
    );
  }

  const polizaDocs = documents.filter(d => d.document_type === 'poliza');
  const soporteDocs = documents.filter(d => d.document_type === 'soporte');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policyAny = policy as any;
  const calculatedTotal = (policy.premium || 0) + (policyAny.gastos_expedicion || 0) + (policyAny.iva || 0);
  const displayTotal = policyAny.total_a_pagar || calculatedTotal;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Póliza {policy.policy_number}
                {policyAny.anexo && policyAny.anexo !== '00' && (
                  <Badge variant="outline">Anexo {policyAny.anexo}</Badge>
                )}
              </h1>
              <Badge className={getStatusColor(policy.status as PolicyStatus)}>
                {POLICY_STATUS_LABELS[policy.status as PolicyStatus] || policy.status}
              </Badge>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><MoreVertical className="h-4 w-4 mr-2" />Acciones</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/polizas/${policyId}/editar`)} className="cursor-pointer">
              <Edit className="h-4 w-4 mr-2" />Editar Póliza
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/polizas/nueva?modificacion=${policyId}`)} className="cursor-pointer">
              <FilePlus className="h-4 w-4 mr-2" />Incluir Modificación
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/polizas/nueva?renovacion=${policyId}`)} className="cursor-pointer">
              <RefreshCw className="h-4 w-4 mr-2" />Renovar Póliza
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCancelDialog(true)} className="cursor-pointer text-red-600" disabled={policy.status === 'cancelada'}>
              <XCircle className="h-4 w-4 mr-2" />Cancelar Póliza
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Detalles de la Póliza */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Detalles de la Póliza</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Número</span><p className="font-medium">{policy.policy_number}</p></div>
                <div><span className="text-muted-foreground">Anexo</span><p className="font-medium">{policyAny.anexo || '00'}</p></div>
                <div><span className="text-muted-foreground">Aseguradora</span><p className="font-medium">{policy.insurance_company?.name || policy.insurer}</p></div>
                <div><span className="text-muted-foreground">Grupo</span><p className="font-medium">{policy.insurance_line?.name || '-'}</p></div>
                <div><span className="text-muted-foreground">Ramo</span><p className="font-medium">{policy.insurance_group?.name || '-'}</p></div>
                <div><span className="text-muted-foreground">Comisión</span><p className="font-medium">{policyAny.commission_pct || 0}%</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Vigencia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Vigencia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Expedición</span><p className="font-medium">{formatDate(policyAny.fecha_expedicion)}</p></div>
                <div><span className="text-muted-foreground">Inicio</span><p className="font-medium">{formatDate(policy.start_date)}</p></div>
                <div><span className="text-muted-foreground">Vencimiento</span><p className="font-medium">{formatDate(policy.end_date)}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Valores de la Póliza</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Prima</span><p className="font-medium text-lg">{formatCurrency(policy.premium)}</p></div>
                <div><span className="text-muted-foreground">Gastos Exp.</span><p className="font-medium text-lg">{formatCurrency(policyAny.gastos_expedicion)}</p></div>
                <div><span className="text-muted-foreground">IVA</span><p className="font-medium text-lg">{formatCurrency(policyAny.iva)}</p></div>
                <div><span className="text-muted-foreground">Total</span><p className="font-semibold text-lg text-green-600">{formatCurrency(displayTotal)}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Notas y Comentarios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Notas y Comentarios</CardTitle>
            </CardHeader>
            <CardContent>
              {policyAny.notas ? (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{policyAny.notas}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No hay comentarios registrados para esta póliza.</p>
              )}
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Documentos</CardTitle>
              <CardDescription>Documentos adjuntos de la póliza</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Documentos de Póliza */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2"><File className="h-4 w-4 text-blue-600" />Documentos de Póliza</h4>
                  <span className="text-xs text-muted-foreground">{polizaDocs.length} / 5</span>
                </div>

                {polizaDocs.length < 5 && (
                  <div className="border-2 border-dashed border-blue-200 rounded-lg p-4 bg-blue-50/50">
                    <label className="flex flex-col items-center justify-center cursor-pointer">
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadDocument(file, 'poliza'); e.target.value = ''; }} className="hidden" disabled={isUploadingPoliza} />
                      {isUploadingPoliza ? <Loader2 className="h-8 w-8 text-blue-400 mb-2 animate-spin" /> : <Upload className="h-8 w-8 text-blue-400 mb-2" />}
                      <span className="text-sm text-blue-600 font-medium">{isUploadingPoliza ? 'Subiendo...' : 'Subir documento'}</span>
                    </label>
                  </div>
                )}

                {polizaDocs.length > 0 ? (
                  <div className="space-y-2">
                    {polizaDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-white border rounded-lg">
                        <div className="flex items-center gap-2 min-w-0"><File className="h-4 w-4 text-blue-600" /><span className="text-sm truncate">{doc.file_name}</span></div>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleViewDocument(doc)} className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteDocId(doc.id)} className="h-8 w-8 p-0 hover:bg-red-100"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (<p className="text-sm text-muted-foreground text-center py-4">No hay documentos de póliza</p>)}
              </div>

              {/* Documentos de Soporte */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2"><File className="h-4 w-4 text-green-600" />Documentos de Soporte</h4>
                  <span className="text-xs text-muted-foreground">{soporteDocs.length} / 8</span>
                </div>

                {soporteDocs.length < 8 && (
                  <div className="border-2 border-dashed border-green-200 rounded-lg p-4 bg-green-50/50">
                    <label className="flex flex-col items-center justify-center cursor-pointer">
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadDocument(file, 'soporte'); e.target.value = ''; }} className="hidden" disabled={isUploadingSoporte} />
                      {isUploadingSoporte ? <Loader2 className="h-8 w-8 text-green-400 mb-2 animate-spin" /> : <Upload className="h-8 w-8 text-green-400 mb-2" />}
                      <span className="text-sm text-green-600 font-medium">{isUploadingSoporte ? 'Subiendo...' : 'Subir documento'}</span>
                    </label>
                  </div>
                )}

                {soporteDocs.length > 0 ? (
                  <div className="space-y-2">
                    {soporteDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-white border rounded-lg">
                        <div className="flex items-center gap-2 min-w-0"><File className="h-4 w-4 text-green-600" /><span className="text-sm truncate">{doc.file_name}</span></div>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleViewDocument(doc)} className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteDocId(doc.id)} className="h-8 w-8 p-0 hover:bg-red-100"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (<p className="text-sm text-muted-foreground text-center py-4">No hay documentos de soporte</p>)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {policy.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{policy.client.full_name}</p>
                  <p className="text-sm text-muted-foreground">{policy.client.doc_type.toUpperCase()}: {policy.client.doc_number}</p>
                  {policy.client.email && <p className="text-sm">{policy.client.email}</p>}
                  {policy.client.phone && <p className="text-sm">{policy.client.phone}</p>}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => router.push(`/clientes/${policy.client?.id}`)}>Ver Cliente</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Prima</span><span className="font-medium">{formatCurrency(policy.premium)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gastos</span><span className="font-medium">{formatCurrency(policyAny.gastos_expedicion)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IVA</span><span className="font-medium">{formatCurrency(policyAny.iva)}</span></div>
                <div className="flex justify-between pt-2 border-t"><span className="font-medium">Total</span><span className="font-bold text-green-600">{formatCurrency(displayTotal)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Cancelar */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Póliza</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas cancelar la póliza <strong>{policy.policy_number}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>No, mantener</Button>
            <Button variant="destructive" onClick={handleCancelPolicy} disabled={isCanceling}>
              {isCanceling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelando...</> : 'Sí, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar Doc */}
      <Dialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Documento</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar este documento? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDocId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteDocument} disabled={isDeletingDoc}>
              {isDeletingDoc ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Eliminando...</> : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
