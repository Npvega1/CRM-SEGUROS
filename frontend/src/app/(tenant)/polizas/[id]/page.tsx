'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PolicyStatusStepper } from '@/components/modules/policies/PolicyStatusStepper';
import {
  type PolicyStatus,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  formatDate
} from '@/lib/validations/policies';
import {
  ArrowLeft,
  Loader2,
  FileText,
  Calendar,
  DollarSign,
  User,
  Users,
  Edit,
  RefreshCw,
  Trash2,
  Building,
  Clock,
  Paperclip,
  Plus,
  XCircle,
  Download,
  File,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// =====================================================
// Utilidad para formato de moneda
// =====================================================
const formatCurrency = (value: number | null | undefined): string => {
  if (!value && value !== 0) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// =====================================================
// Interfaz de documento
// =====================================================
interface PolicyDoc {
  id: string;
  document_type: string;
  document_name: string;
  file_name: string;
  file_url: string;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
export default function DetallePolizaPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId, role } = useTenant();
  const supabase = createClient();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasRemision, setHasRemision] = useState(false);
  const [hasRecaudo, setHasRecaudo] = useState(false);

  // Documentos
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [policyDocs, setPolicyDocs] = useState<PolicyDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const copiaInputRef = useRef<HTMLInputElement>(null);
  const soporteInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'admin' || role === 'superadmin';

  // =====================================================
  // Cargar poliza con relaciones
  // =====================================================
  async function loadPolicy() {
    if (!policyId || !tenantId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('policies')
        .select(`
          *,
          client:clients(id, full_name, doc_type, doc_number, email, phone),
          insurance_company:insurance_companies(id, name),
          insurance_line:insurance_lines(id, name),
          insurance_group:insurance_groups(id, name)
        `)
        .eq('id', policyId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw error;
      setPolicy(data);
    } catch (err) {
      console.error('Error loading policy:', err);
      toast.error('Error al cargar la póliza');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPolicy();
  }, [policyId, tenantId]);

  // =====================================================
  // Cargar estado de producción (Remisión y Cartera)
  // =====================================================
  useEffect(() => {
    async function loadProductionStatus() {
      if (!policyId || !tenantId) return;
      try {
        // Verificar si existe remisión CON numero_remision asignado
        const { data: remisionData } = await (supabase as any)
          .from('remisiones')
          .select('id, numero_remision')
          .eq('policy_id', policyId)
          .eq('tenant_id', tenantId)
          .limit(1);

        const remisionRecord = remisionData && remisionData.length > 0 ? remisionData[0] : null;
        setHasRemision(
          remisionRecord !== null &&
          remisionRecord.numero_remision !== null &&
          remisionRecord.numero_remision !== ''
        );

        // Verificar si fue recaudada (saldo_pendiente <= 0)
        const { data: carteraData } = await (supabase as any)
          .from('cartera')
          .select('id, saldo_pendiente')
          .eq('policy_id', policyId)
          .eq('tenant_id', tenantId)
          .limit(1);

        if (carteraData && carteraData.length > 0) {
          setHasRecaudo(carteraData[0].saldo_pendiente <= 0);
        } else {
          setHasRecaudo(false);
        }
      } catch (err) {
        console.error('Error loading production status:', err);
      }
    }
    if (policy) {
      loadProductionStatus();
    }
  }, [policy, policyId, tenantId]);

  // =====================================================
  // Cargar documentos de la póliza
  // =====================================================
  async function loadDocs() {
    if (!policyId || !tenantId) return;
    setLoadingDocs(true);
    try {
      const { data } = await (supabase as any)
        .from('policy_documents')
        .select('id, document_type, document_name, file_name, file_url')
        .eq('policy_id', policyId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      setPolicyDocs(data || []);
    } catch (err) {
      console.error('Error loading docs:', err);
    }
    setLoadingDocs(false);
  }

  useEffect(() => {
    if (policy) {
      loadDocs();
    }
  }, [policy]);

  // =====================================================
  // Subir documento
  // =====================================================
  const handleUploadDoc = async (file: globalThis.File, docType: string, docName: string) => {
    if (!tenantId || !policyId) return;
    setUploadingDoc(true);

    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${tenantId}/policies/${policyId}/documentos/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        toast.error(`Error al subir: ${uploadError.message}`);
        setUploadingDoc(false);
        return;
      }

      const { error: insertError } = await (supabase as any)
        .from('policy_documents')
        .insert({
          tenant_id: tenantId,
          policy_id: policyId,
          document_type: docType,
          document_name: docName,
          file_url: path,
          file_name: file.name
        });

      if (insertError) {
        toast.error(`Error al guardar: ${insertError.message}`);
      } else {
        toast.success('Documento subido correctamente');
        await loadDocs();
      }
    } catch {
      toast.error('Error al subir documento');
    }
    setUploadingDoc(false);
  };

  // =====================================================
  // Eliminar documento
  // =====================================================
  const handleDeleteDoc = async (doc: PolicyDoc) => {
    if (!confirm(`¿Eliminar "${doc.file_name}"?`)) return;

    try {
      await supabase.storage
        .from('policy-documents')
        .remove([doc.file_url]);

      await (supabase as any)
        .from('policy_documents')
        .delete()
        .eq('id', doc.id);

      toast.success('Documento eliminado');
      await loadDocs();
    } catch {
      toast.error('Error al eliminar documento');
    }
  };

  // =====================================================
  // Descargar documento (signedUrl)
  // =====================================================
  const handleDownloadDoc = async (doc: PolicyDoc) => {
    try {
      const { data, error } = await supabase.storage
        .from('policy-documents')
        .createSignedUrl(doc.file_url, 60);

      if (error || !data?.signedUrl) {
        toast.error('Error al generar enlace de descarga');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Error al descargar');
    }
  };

  // =====================================================
  // Eliminar poliza
  // =====================================================
  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta póliza? Esta acción no se puede deshacer.')) return;

    try {
      const { error } = await (supabase as any)
        .from('policies')
        .delete()
        .eq('id', policyId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast.success('Póliza eliminada');
      router.push('/polizas');
    } catch (err: any) {
      console.error('Error deleting policy:', err);
      toast.error(err.message || 'Error al eliminar la póliza');
    }
  };

  // =====================================================
  // Estados de carga
  // =====================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Póliza no encontrada</p>
          <Link href="/polizas">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Pólizas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const policyAny = policy as any;
  const displayTotal = policyAny.total_a_pagar || (
    (policy.premium || 0) + (policyAny.gastos_expedicion || 0) + (policyAny.iva || 0)
  );

  // Documentos separados por tipo
  const copiaPoliza = policyDocs.find(d => d.document_type === 'copia_poliza');
  const soportes = policyDocs.filter(d => d.document_type === 'soporte');

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <div className="container mx-auto py-6 px-4">
      {/* ============================================= */}
      {/* HEADER + BOTONES DE ACCION */}
      {/* ============================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/polizas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                Póliza {policy.policy_number}
              </h1>
              <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                {POLICY_STATUS_LABELS[policy.status as PolicyStatus] || policy.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {policy.insurance_company?.name || policy.insurer} - {policy.client?.full_name || 'Sin cliente'}
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowDocPanel(true)}>
            <Paperclip className="h-4 w-4 mr-2" />
            Adjuntar Documentos
          </Button>
          <Link href={`/polizas/${policyId}/editar`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </Link>
          <Link href={`/polizas/modificar?poliza=${policyId}`}>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Incluir Anexo
            </Button>
          </Link>
          <Link href={`/polizas/renovar?poliza=${policyId}`}>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Renovar
            </Button>
          </Link>
          <Link href={`/polizas/cancelar?poliza=${policyId}`}>
            <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </Link>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* ============================================= */}
      {/* STATUS STEPPER */}
      {/* ============================================= */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <PolicyStatusStepper
            hasRemision={hasRemision}
            hasRecaudo={hasRecaudo}
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* ============================================= */}
        {/* DETALLES DE LA POLIZA */}
        {/* ============================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Detalles de la Póliza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Número</p>
                <p className="font-medium">{policy.policy_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Anexo</p>
                <p className="font-medium">{policyAny.anexo || '00'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aseguradora</p>
                <p className="font-medium">
                  {policy.insurance_company?.name || policy.insurer}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ramo</p>
                <p className="font-medium">
                  {policy.insurance_line?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Grupo</p>
                <p className="font-medium">
                  {policy.insurance_group?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo Movimiento</p>
                <p className="font-medium capitalize">
                  {policyAny.tipo_movimiento || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* VIGENCIA */}
        {/* ============================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Vigencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Fecha Expedición</p>
                <p className="font-medium">{formatDate(policyAny.fecha_expedicion)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vigencia Desde</p>
                <p className="font-medium">{formatDate(policy.start_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vigencia Hasta</p>
                <p className="font-medium">{formatDate(policy.end_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Días de Vigencia</p>
                <p className="font-medium">{policyAny.dias_vigencia || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* TOMADOR */}
        {/* ============================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Tomador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre / Razón Social</p>
                <p className="font-medium">
                  {policyAny.tomador_nombre || policy.client?.full_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo Identificación</p>
                <p className="font-medium capitalize">
                  {(policyAny.tomador_tipo_identificacion || policy.client?.doc_type || '-').replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Número Identificación</p>
                <p className="font-medium">
                  {policyAny.tomador_numero_identificacion || policy.client?.doc_number || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* ASEGURADO (solo si es diferente al tomador) */}
        {/* ============================================= */}
        {policyAny.asegurado_diferente && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Asegurado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{policyAny.asegurado_nombre || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo Identificación</p>
                  <p className="font-medium capitalize">
                    {(policyAny.asegurado_tipo_identificacion || '-').replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Número Identificación</p>
                  <p className="font-medium">
                    {policyAny.asegurado_numero_identificacion || '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================= */}
        {/* VALORES DE LA POLIZA */}
        {/* ============================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Valores de la Póliza
              {policyAny.anexo && policyAny.anexo !== '00' && ` (Anexo ${policyAny.anexo})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor Asegurado</p>
                <p className="font-medium text-lg">
                  {formatCurrency(policyAny.valor_asegurado)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prima Neta</p>
                <p className="font-medium text-lg">
                  {formatCurrency(policy.premium)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gastos Exp.</p>
                <p className="font-medium text-lg">
                  {formatCurrency(policyAny.gastos_expedicion)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IVA</p>
                <p className="font-medium text-lg">
                  {formatCurrency(policyAny.iva)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total a Pagar</p>
                <p className="font-medium text-lg text-emerald-600">
                  {formatCurrency(displayTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comisión</p>
                <p className="font-medium text-lg">
                  {policyAny.commission_pct || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* CLIENTE */}
        {/* ============================================= */}
        {policy.client && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{policy.client.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <p className="font-medium">{policy.client.doc_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{policy.client.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{policy.client.phone || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================= */}
        {/* NOTAS */}
        {/* ============================================= */}
        {policyAny.notas && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{policyAny.notas}</p>
            </CardContent>
          </Card>
        )}

        {/* ============================================= */}
        {/* REGISTRO / TIMESTAMPS */}
        {/* ============================================= */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Registro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Creado</p>
                <p className="font-medium">{formatDate(policy.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Actualización</p>
                <p className="font-medium">{formatDate(policy.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================= */}
      {/* DIALOG: ADJUNTAR DOCUMENTOS */}
      {/* ============================================= */}
      <Dialog open={showDocPanel} onOpenChange={setShowDocPanel}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Documentos de la Póliza
            </DialogTitle>
          </DialogHeader>

          {loadingDocs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* ---- Copia de la Póliza ---- */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Copia de la Póliza</h4>
                {copiaPoliza ? (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{copiaPoliza.file_name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadDoc(copiaPoliza)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteDoc(copiaPoliza)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={copiaInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDoc(file, 'copia_poliza', 'Copia de la póliza');
                        e.target.value = '';
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={uploadingDoc}
                      onClick={() => copiaInputRef.current?.click()}
                    >
                      {uploadingDoc ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Subir copia de póliza
                    </Button>
                  </div>
                )}
              </div>

              {/* ---- Soportes ---- */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Soportes ({soportes.length}/5)</h4>
                <div className="space-y-2">
                  {soportes.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{doc.file_name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadDoc(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteDoc(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {soportes.length < 5 && (
                    <div>
                      <input
                        ref={soporteInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDoc(file, 'soporte', `Soporte ${soportes.length + 1}`);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={uploadingDoc}
                        onClick={() => soporteInputRef.current?.click()}
                      >
                        {uploadingDoc ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Subir soporte
                      </Button>
                    </div>
                  )}

                  {soportes.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No hay soportes adjuntos</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
