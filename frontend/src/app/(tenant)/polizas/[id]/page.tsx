'use client';

import { useEffect, useState, useCallback } from 'react';
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
  DialogTrigger,
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
  Download,
  RefreshCw,
  Trash2,
  Building,
  Clock,
  Upload,
  X,
  Paperclip,
  History,
  Plus,
  Eye
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
// COMPONENTE: Historial de Renovaciones
// FIX: Tipado explícito en destructuring de Supabase
// =====================================================
function RenewalHistory({
  policyId,
  policyNumber,
  tenantId
}: {
  policyId: string;
  policyNumber: string;
  tenantId: string;
}) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      // Pólizas que fueron renovadas DESDE esta (vigencias futuras)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: nextPolicies }: { data: any[] | null } = await (supabase as any)
        .from('policies')
        .select('id, policy_number, anexo, status, start_date, end_date, premium, policy_type, renewed_from_policy_id')
        .eq('renewed_from_policy_id', policyId)
        .eq('tenant_id', tenantId)
        .eq('anexo', '00')
        .order('start_date', { ascending: true });

      // Buscar la póliza padre (de dónde se renovó esta)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentPolicy }: { data: any | null } = await (supabase as any)
        .from('policies')
        .select('renewed_from_policy_id')
        .eq('id', policyId)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let previousPolicies: any[] = [];
      if (currentPolicy?.renewed_from_policy_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prevData }: { data: any[] | null } = await (supabase as any)
          .from('policies')
          .select('id, policy_number, anexo, status, start_date, end_date, premium, policy_type, renewed_from_policy_id')
          .eq('id', currentPolicy.renewed_from_policy_id)
          .eq('tenant_id', tenantId);

        previousPolicies = prevData || [];
      }

      setHistory([...previousPolicies, ...(nextPolicies || [])]);
    } catch (err) {
      console.error('Error loading renewal history:', err);
    } finally {
      setLoading(false);
    }
  }, [policyId, tenantId, supabase]);

  useEffect(() => {
    if (policyId && tenantId) {
      loadHistory();
    }
  }, [policyId, tenantId, loadHistory]);

  if (loading) return null;
  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          Historial de Vigencias
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {history.map((p: any) => (
            <Link
              key={p.id}
              href={`/polizas/${p.id}`}
              className={`flex items-center justify-between p-2 rounded-lg border transition-colors text-xs ${
                p.id === policyId
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    p.policy_type === 'renovacion'
                      ? 'border-blue-500 text-blue-700 bg-blue-50'
                      : 'border-green-500 text-green-700 bg-green-50'
                  }
                >
                  {p.policy_type === 'renovacion' ? 'R' : 'N'}
                </Badge>
                <span className="font-medium">{p.policy_number}</span>
                {p.id === policyId && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    Actual
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {formatDate(p.start_date)} → {formatDate(p.end_date)}
                </span>
                <Badge className={POLICY_STATUS_COLORS[p.status as PolicyStatus] || 'bg-gray-100 text-gray-800'}>
                  {POLICY_STATUS_LABELS[p.status as PolicyStatus] || p.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// COMPONENTE: Diálogo de Documentos Adjuntos
// Copia de póliza (máx 1) + Soportes (máx 5)
// =====================================================
function PolicyDocumentsDialog({
  policyId,
  tenantId
}: {
  policyId: string;
  tenantId: string;
}) {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data }: { data: any[] | null } = await (supabase as any)
        .from('policy_documents')
        .select('*')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });

      setDocuments(data || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  }, [policyId, supabase]);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, loadDocuments]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copiaPoliza = documents.filter((d: any) => d.document_type === 'copia_poliza');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soportes = documents.filter((d: any) => d.document_type === 'soporte');

  const handleUpload = async (file: File, docType: string) => {
    setUploading(true);
    try {
      const filePath = `${tenantId}/${policyId}/${docType}_${Date.now()}_${file.name}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadError } = await (supabase as any).storage
        .from('policy-documents')
        .upload(filePath, file);

      if (uploadError) {
        toast.error('Error al subir archivo: ' + uploadError.message);
        setUploading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from('policy_documents')
        .insert({
          policy_id: policyId,
          tenant_id: tenantId,
          document_type: docType,
          file_name: file.name,
          file_url: filePath,
          file_size: file.size
        });

      if (insertError) {
        toast.error('Error al registrar documento');
      } else {
        toast.success('Documento subido exitosamente');
        loadDocuments();
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      toast.error('Error de conexión al subir documento');
    } finally {
      setUploading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDownload = async (doc: any) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data }: { data: any | null } = await (supabase as any).storage
        .from('policy-documents')
        .createSignedUrl(doc.file_url, 60);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast.error('No se pudo generar el enlace de descarga');
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      toast.error('Error al descargar');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteDoc = async (doc: any) => {
    if (!confirm(`¿Eliminar el documento "${doc.file_name}"?`)) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).storage
        .from('policy-documents')
        .remove([doc.file_url]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('policy_documents')
        .delete()
        .eq('id', doc.id);

      toast.success('Documento eliminado');
      loadDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error('Error al eliminar documento');
    }
  };

  const handleFileSelect = (docType: string, maxCount: number) => {
    const currentCount = documents.filter(d => d.document_type === docType).length;
    if (currentCount >= maxCount) {
      toast.error(
        docType === 'copia_poliza'
          ? 'Ya existe una copia de póliza. Elimínala primero para subir otra.'
          : `Máximo ${maxCount} soportes permitidos.`
      );
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleUpload(file, docType);
      }
    };
    input.click();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDocumentRow = (doc: any) => (
    <div
      key={doc.id}
      className="flex items-center justify-between p-2 rounded border text-xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="truncate">{doc.file_name}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => handleDownload(doc)}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
          onClick={() => handleDeleteDoc(doc)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Paperclip className="h-4 w-4" />
          Documentos
          {documents.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {documents.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Documentos Adjuntos
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Copia de Póliza (máx 1) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Copia de Póliza</h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleFileSelect('copia_poliza', 1)}
                  disabled={uploading || copiaPoliza.length >= 1}
                >
                  <Upload className="h-3 w-3" />
                  Subir
                </Button>
              </div>
              {copiaPoliza.length > 0 ? (
                <div className="space-y-1">
                  {copiaPoliza.map(renderDocumentRow)}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Sin copia de póliza adjunta
                </p>
              )}
            </div>

            {/* Soportes (máx 5) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">
                  Soportes ({soportes.length}/5)
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleFileSelect('soporte', 5)}
                  disabled={uploading || soportes.length >= 5}
                >
                  <Upload className="h-3 w-3" />
                  Subir
                </Button>
              </div>
              {soportes.length > 0 ? (
                <div className="space-y-1">
                  {soportes.map(renderDocumentRow)}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Sin soportes adjuntos
                </p>
              )}
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Subiendo documento...
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
export default function DetallePolizaPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId, tenantSlug } = useTenant();
  const supabase = createClient();
  const policyId = params.id as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [anexos, setAnexos] = useState<any[]>([]);
  const [consolidatedEndDate, setConsolidatedEndDate] = useState<string | null>(null);

  // =====================================================
  // Cargar póliza con relaciones
  // =====================================================
  async function loadPolicy() {
    if (!policyId || !tenantId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Si es póliza principal (anexo 00), cargar anexos y vigencia consolidada
      if (data && (data.anexo === '00' || !data.anexo)) {
        await loadAnexos(data.id, data.policy_number);
      }
    } catch (err) {
      console.error('Error loading policy:', err);
      toast.error('Error al cargar la póliza');
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // Cargar anexos de la póliza principal
  // =====================================================
  async function loadAnexos(parentId: string, policyNumber: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: anexosData }: { data: any[] | null } = await (supabase as any)
        .from('policies')
        .select('id, policy_number, anexo, tipo_movimiento, premium, gastos_expedicion, iva, total_a_pagar, status, start_date, end_date')
        .eq('parent_policy_id', parentId)
        .eq('tenant_id', tenantId)
        .order('anexo', { ascending: true });

      const validAnexos = anexosData || [];
      setAnexos(validAnexos);

      // Calcular vigencia consolidada (max end_date entre principal y todos los anexos)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allEndDates = [policy?.end_date, ...validAnexos.map((a: any) => a.end_date)].filter(Boolean);
      if (allEndDates.length > 0) {
        const maxDate = allEndDates.reduce((max: string, d: string) =>
          new Date(d) > new Date(max) ? d : max
        );
        setConsolidatedEndDate(maxDate);
      }
    } catch (err) {
      console.error('Error loading anexos:', err);
    }
  }

  useEffect(() => {
    loadPolicy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId, tenantId]);

  // =====================================================
  // Cambiar estado de la póliza
  // =====================================================
  const handleStatusChange = async (newStatus: PolicyStatus, note?: string) => {
    if (!policyId || !tenantId) return;
    setStatusLoading(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('policies')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', policyId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Registrar en historial
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('policy_history')
        .insert({
          policy_id: policyId,
          old_status: policy.status,
          new_status: newStatus,
          note: note || null,
          changed_at: new Date().toISOString()
        });

      toast.success(`Estado cambiado a ${POLICY_STATUS_LABELS[newStatus]}`);
      await loadPolicy();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cambiar estado';
      console.error('Error changing status:', err);
      toast.error(errorMessage);
    } finally {
      setStatusLoading(false);
    }
  };

  // =====================================================
  // Eliminar póliza
  // =====================================================
  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta póliza? Esta acción no se puede deshacer.')) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('policies')
        .delete()
        .eq('id', policyId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast.success('Póliza eliminada');
      router.push('/polizas');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar la póliza';
      console.error('Error deleting policy:', err);
      toast.error(errorMessage);
    }
  };

  // =====================================================
  // Estados de carga
  // =====================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Póliza no encontrada</p>
        <Link href="/polizas">
          <Button variant="link" className="mt-2">Volver a Pólizas</Button>
        </Link>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policyAny = policy as any;
  const displayTotal = policyAny.total_a_pagar || (
    (policy.premium || 0) + (policyAny.gastos_expedicion || 0) + (policyAny.iva || 0)
  );
  const isPrincipal = !policyAny.anexo || policyAny.anexo === '00';
  const isRenewal = policyAny.policy_type === 'renovacion';

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <div className="space-y-6">

      {/* ============================================= */}
      {/* HEADER + BOTONES DE ACCIÓN                    */}
      {/* ============================================= */}
      <div>
        <Link
          href="/polizas"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Pólizas
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">
                Póliza {policy.policy_number}
              </h1>
              {/* Badge de estado */}
              <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus] || 'bg-gray-100 text-gray-800'}>
                {POLICY_STATUS_LABELS[policy.status as PolicyStatus] || policy.status}
              </Badge>
              {/* Badge R/N (Renovación / Nueva) */}
              {isRenewal && (
                <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
                  R - Renovación
                </Badge>
              )}
              {/* Badge de Anexo */}
              {!isPrincipal && (
                <Badge variant="outline">Anexo {policyAny.anexo}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {policy.insurance_company?.name || policy.insurer} - {policy.client?.full_name || 'Sin cliente'}
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Documentos (Dialog) */}
            <PolicyDocumentsDialog policyId={policyId} tenantId={tenantId!} />

            {/* Editar */}
            <Link href={`/polizas/${policyId}/editar`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            </Link>

            {/* Incluir Anexo (solo para póliza principal) */}
            {isPrincipal && (
              <Link href={`/polizas/modificar?poliza=${policyId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Incluir Anexo
                </Button>
              </Link>
            )}

            {/* Renovar (solo para póliza principal) */}
            {isPrincipal && (
              <Link href={`/polizas/renovar?poliza=${policyId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  Renovar
                </Button>
              </Link>
            )}

            {/* Eliminar */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* STATUS STEPPER                                */}
      {/* ============================================= */}
      <PolicyStatusStepper
        currentStatus={policy.status as PolicyStatus}
        onStatusChange={handleStatusChange}
        isLoading={statusLoading}
      />

      {/* ============================================= */}
      {/* HISTORIAL DE VIGENCIAS (Renovaciones)         */}
      {/* ============================================= */}
      {isPrincipal && (
        <RenewalHistory
          policyId={policyId}
          policyNumber={policy.policy_number}
          tenantId={tenantId!}
        />
      )}

      {/* ============================================= */}
      {/* LINK A PÓLIZA PRINCIPAL (para anexos)         */}
      {/* ============================================= */}
      {!isPrincipal && policyAny.parent_policy_id && (
        <Card className="border-dashed">
          <CardContent className="py-3 px-4">
            <Link
              href={`/polizas/${policyAny.parent_policy_id}`}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Eye className="h-4 w-4" />
              Ver póliza principal ({policy.policy_number} - Anexo 00)
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ============================================= */}
      {/* DETALLES DE LA PÓLIZA                         */}
      {/* ============================================= */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Detalles de la Póliza
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Número</p>
              <p className="text-sm font-medium">{policy.policy_number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Anexo</p>
              <p className="text-sm font-medium">{policyAny.anexo || '00'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aseguradora</p>
              <p className="text-sm font-medium">{policy.insurance_company?.name || policy.insurer}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ramo</p>
              <p className="text-sm font-medium">{policy.insurance_line?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grupo</p>
              <p className="text-sm font-medium">{policy.insurance_group?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo Movimiento</p>
              <p className="text-sm font-medium capitalize">{policyAny.tipo_movimiento || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================= */}
      {/* VIGENCIA                                      */}
      {/* ============================================= */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Vigencia
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Fecha Expedición</p>
              <p className="text-sm font-medium">{formatDate(policyAny.fecha_expedicion)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vigencia Desde</p>
              <p className="text-sm font-medium">{formatDate(policy.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vigencia Hasta</p>
              <p className="text-sm font-medium">{formatDate(policy.end_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Días de Vigencia</p>
              <p className="text-sm font-medium">{policyAny.dias_vigencia || '-'}</p>
            </div>
          </div>
          {/* Vigencia consolidada para póliza principal con anexos */}
          {isPrincipal && consolidatedEndDate && consolidatedEndDate !== policy.end_date && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">Vigencia Consolidada (con anexos)</p>
              <p className="text-sm font-medium text-primary">
                {formatDate(policy.start_date)} → {formatDate(consolidatedEndDate)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================= */}
      {/* TOMADOR                                       */}
      {/* ============================================= */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Tomador
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Nombre / Razón Social</p>
              <p className="text-sm font-medium">
                {policyAny.tomador_nombre || policy.client?.full_name || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo Identificación</p>
              <p className="text-sm font-medium">
                {(policyAny.tomador_tipo_identificacion || policy.client?.doc_type || '-').replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Número Identificación</p>
              <p className="text-sm font-medium">
                {policyAny.tomador_numero_identificacion || policy.client?.doc_number || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================= */}
      {/* ASEGURADO (solo si es diferente al tomador)   */}
      {/* ============================================= */}
      {policyAny.asegurado_diferente && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Asegurado
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Nombre</p>
                <p className="text-sm font-medium">{policyAny.asegurado_nombre || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo Identificación</p>
                <p className="text-sm font-medium">
                  {(policyAny.asegurado_tipo_identificacion || '-').replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Número Identificación</p>
                <p className="text-sm font-medium">{policyAny.asegurado_numero_identificacion || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================= */}
      {/* VALORES DE LA PÓLIZA                          */}
      {/* ============================================= */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Valores de la Póliza
            {!isPrincipal && ` (Anexo ${policyAny.anexo})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor Asegurado</p>
              <p className="text-sm font-medium">{formatCurrency(policyAny.valor_asegurado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prima Neta</p>
              <p className="text-sm font-medium">{formatCurrency(policy.premium)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gastos Exp.</p>
              <p className="text-sm font-medium">{formatCurrency(policyAny.gastos_expedicion)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">IVA</p>
              <p className="text-sm font-medium">{formatCurrency(policyAny.iva)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total a Pagar</p>
              <p className="text-sm font-bold">{formatCurrency(displayTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Comisión</p>
              <p className="text-sm font-medium">{policyAny.commission_pct || 0}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================= */}
      {/* TABLA DE ANEXOS (solo póliza principal)       */}
      {/* ============================================= */}
      {isPrincipal && anexos.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Anexos ({anexos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Anexo</th>
                    <th className="pb-2 pr-3 font-medium">Tipo Mov.</th>
                    <th className="pb-2 pr-3 font-medium">Prima</th>
                    <th className="pb-2 pr-3 font-medium">Total</th>
                    <th className="pb-2 pr-3 font-medium">Vigencia</th>
                    <th className="pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {anexos.map((anexo: any) => (
                    <tr key={anexo.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/polizas/${anexo.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {anexo.anexo}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 capitalize">{anexo.tipo_movimiento || '-'}</td>
                      <td className="py-2 pr-3">{formatCurrency(anexo.premium)}</td>
                      <td className="py-2 pr-3">{formatCurrency(anexo.total_a_pagar)}</td>
                      <td className="py-2 pr-3">
                        {formatDate(anexo.start_date)} → {formatDate(anexo.end_date)}
                      </td>
                      <td className="py-2">
                        <Badge
                          className={`text-[10px] ${POLICY_STATUS_COLORS[anexo.status as PolicyStatus] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {POLICY_STATUS_LABELS[anexo.status as PolicyStatus] || anexo.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================= */}
      {/* CLIENTE                                       */}
      {/* ============================================= */}
      {policy.client && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Nombre</p>
                <p className="text-sm font-medium">{policy.client.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Documento</p>
                <p className="text-sm font-medium">{policy.client.doc_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{policy.client.email || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teléfono</p>
                <p className="text-sm font-medium">{policy.client.phone || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================= */}
      {/* NOTAS                                         */}
      {/* ============================================= */}
      {policyAny.notas && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Notas</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm whitespace-pre-wrap">{policyAny.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* ============================================= */}
      {/* REGISTRO / TIMESTAMPS                         */}
      {/* ============================================= */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Registro
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Creado</p>
              <p className="text-sm font-medium">{formatDate(policy.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última Actualización</p>
              <p className="text-sm font-medium">{formatDate(policy.updated_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
