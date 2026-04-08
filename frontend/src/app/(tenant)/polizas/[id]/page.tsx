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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PolicyStatusStepper } from '@/components/modules/policies/PolicyStatusStepper';
import {
  type PolicyStatus,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  formatDate,
  formatPremium
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
  Upload,
  Eye,
  Layers,
  ArrowUp,
  History
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
// Interfaces
// =====================================================
interface PolicyDoc {
  id: string;
  document_type: string;
  document_name: string;
  file_name: string;
  file_url: string;
}

interface AnexoRecord {
  id: string;
  anexo: string;
  premium: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
}

// =====================================================
// Componente: Historial de Vigencias
// =====================================================
function RenewalHistory({ policyId, tenantId }: { policyId: string; tenantId: string }) {
  const supabase = createClient();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      if (!tenantId || !policyId) return;
      try {
        // Cargar la póliza actual
        const { data: currentPolicy } = await (supabase as any)
          .from('policies')
          .select('id, policy_number, anexo, start_date, end_date, status, policy_type, renewed_from_policy_id')
          .eq('id', policyId)
          .eq('tenant_id', tenantId)
          .single();

        if (!currentPolicy) { setLoading(false); return; }

        // Ir hacia atrás por renewed_from_policy_id
        const backwards: any[] = [];
        let lookbackId = currentPolicy.renewed_from_policy_id;
        while (lookbackId) {
          const { data: prevPolicy } = await (supabase as any)
            .from('policies')
            .select('id, policy_number, anexo, start_date, end_date, status, policy_type, renewed_from_policy_id')
            .eq('id', lookbackId)
            .eq('tenant_id', tenantId)
            .single();
          if (!prevPolicy) break;
          backwards.unshift(prevPolicy);
          lookbackId = prevPolicy.renewed_from_policy_id;
        }

        // Ir hacia adelante (pólizas que renovaron esta)
        const forwards: any[] = [];
        let lookforwardId: string | null = policyId;
        while (lookforwardId) {
          const { data: nextPolicies } = await (supabase as any)
            .from('policies')
            .select('id, policy_number, anexo, start_date, end_date, status, policy_type, renewed_from_policy_id')
            .eq('renewed_from_policy_id', lookforwardId)
            .eq('tenant_id', tenantId)
            .eq('anexo', '00')
            .limit(1);
          if (nextPolicies && nextPolicies.length > 0) {
            forwards.push(nextPolicies[0]);
            lookforwardId = nextPolicies[0].id;
          } else {
            lookforwardId = null;
          }
        }

        const fullChain = [...backwards, currentPolicy, ...forwards];

        // Solo mostrar si hay más de 1 vigencia
        if (fullChain.length > 1) {
          setHistory(fullChain);
        }
      } catch (err) {
        console.error('Error loading renewal history:', err);
      }
      setLoading(false);
    }
    loadHistory();
  }, [policyId, tenantId, supabase]);

  if (loading || history.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="w-4 h-4" />
          Historial de Vigencias ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="flex items-center gap-1 flex-wrap">
          {history.map((h, idx) => {
            const isCurrent = h.id === policyId;
            const startYear = h.start_date ? new Date(h.start_date).getFullYear() : '?';
            const endYear = h.end_date ? new Date(h.end_date).getFullYear() : '?';

            return (
              <div key={h.id} className="flex items-center gap-1">
                {idx > 0 && <span className="text-muted-foreground text-xs mx-1">→</span>}
                {isCurrent ? (
                  <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">
                    {h.policy_number} ({startYear}-{endYear}) - Actual
                  </span>
                ) : (
                  <Link href={`/polizas/${h.id}`}>
                    <span className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50 cursor-pointer">
                      {h.policy_number} ({startYear}-{endYear})
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
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

  // Anexos
  const [anexos, setAnexos] = useState<AnexoRecord[]>([]);
  const [consolidatedEndDate, setConsolidatedEndDate] = useState<string | null>(null);

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
  // Cargar anexos relacionados + vigencia consolidada
  // =====================================================
  useEffect(() => {
    async function loadAnexos() {
      if (!policy || !tenantId) return;
      try {
        const { data } = await (supabase as any)
          .from('policies')
          .select('id, anexo, premium, start_date, end_date, status, created_at')
          .eq('parent_policy_id', policyId)
          .eq('tenant_id', tenantId)
          .order('anexo', { ascending: true });

        const anexosList = (data || []) as AnexoRecord[];
        setAnexos(anexosList);

        let maxEndDate = policy.end_date || null;
        anexosList.forEach((a) => {
          if (a.end_date && (!maxEndDate || a.end_date > maxEndDate)) {
            maxEndDate = a.end_date;
          }
        });
        setConsolidatedEndDate(maxEndDate);
      } catch (err) {
        console.error('Error loading anexos:', err);
      }
    }
    if (policy) {
      loadAnexos();
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
  // Descargar documento
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
  const isAnexo = policyAny.anexo && policyAny.anexo !== '00';
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
    <div className="container mx-auto py-4 px-4">
      {/* ============================================= */}
      {/* HEADER + BOTONES DE ACCION */}
      {/* ============================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Link href={isAnexo && policyAny.parent_policy_id ? `/polizas/${policyAny.parent_policy_id}` : '/polizas'}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                Póliza {policy.policy_number}
                {isAnexo && <span className="text-muted-foreground"> - Anexo {policyAny.anexo}</span>}
              </h1>
              <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                {POLICY_STATUS_LABELS[policy.status as PolicyStatus] || policy.status}
              </Badge>
              {policyAny.policy_type === 'renovacion' ? (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">R</Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">N</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {policy.insurance_company?.name || policy.insurer} - {policy.client?.full_name || 'Sin cliente'}
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowDocPanel(true)}>
            <Paperclip className="h-3.5 w-3.5 mr-1.5" />
            Documentos
          </Button>
          <Link href={`/polizas/${policyId}/editar`}>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
          </Link>
          {!isAnexo && (
            <>
              <Link href={`/polizas/modificar?poliza=${policyId}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Incluir Anexo
                </Button>
              </Link>
              <Link href={`/polizas/renovar?poliza=${policyId}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Renovar
                </Button>
              </Link>
              <Link href={`/polizas/cancelar?poliza=${policyId}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancelar
                </Button>
              </Link>
            </>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* ============================================= */}
      {/* LINK A PÓLIZA PADRE (si es anexo) */}
      {/* ============================================= */}
      {isAnexo && policyAny.parent_policy_id && (
        <div className="mb-3">
          <Link href={`/polizas/${policyAny.parent_policy_id}`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
              <ArrowUp className="h-3 w-3 mr-1" />
              Ver póliza principal (Anexo 00)
            </Button>
          </Link>
        </div>
      )}

      {/* ============================================= */}
      {/* STATUS STEPPER (solo para anexo 00) */}
      {/* ============================================= */}
      {!isAnexo && (
        <Card className="mb-4">
          <CardContent className="pt-3 pb-3">
            <PolicyStatusStepper
              hasRemision={hasRemision}
              hasRecaudo={hasRecaudo}
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {/* ============================================= */}
        {/* DETALLES DE LA POLIZA (compacto) */}
        {/* ============================================= */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4" />
              Detalles de la Póliza
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
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
        {/* VIGENCIA (compacto) */}
        {/* ============================================= */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              Vigencia
              {!isAnexo && consolidatedEndDate && consolidatedEndDate !== policy.end_date && (
                <Badge variant="outline" className="text-xs ml-2">Vigencia consolidada</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <p className="text-sm font-medium">
                  {policy.start_date && policy.end_date
                    ? Math.ceil((new Date(policy.end_date).getTime() - new Date(policy.start_date).getTime()) / (1000 * 60 * 60 * 24))
                    : '-'}
                </p>
              </div>
            </div>
            {!isAnexo && consolidatedEndDate && consolidatedEndDate !== policy.end_date && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                Vigencia consolidada (con anexos): hasta <strong>{formatDate(consolidatedEndDate)}</strong>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* TOMADOR (compacto) */}
        {/* ============================================= */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              Tomador
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Nombre / Razón Social</p>
                <p className="text-sm font-medium">{policyAny.tomador_nombre || policy.client?.full_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo Identificación</p>
                <p className="text-sm font-medium capitalize">
                  {(policyAny.tomador_tipo_identificacion || policy.client?.doc_type || '-').replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Número Identificación</p>
                <p className="text-sm font-medium">{policyAny.tomador_numero_identificacion || policy.client?.doc_number || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* ASEGURADO (solo si es diferente) */}
        {/* ============================================= */}
        {policyAny.asegurado_diferente && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" />
                Asegurado
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="text-sm font-medium">{policyAny.asegurado_nombre || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo Identificación</p>
                  <p className="text-sm font-medium capitalize">
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
        {/* VALORES (compacto) */}
        {/* ============================================= */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4" />
              Valores de la Póliza
              {isAnexo && ` (Anexo ${policyAny.anexo})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
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
                <p className="text-sm font-medium text-emerald-600">{formatCurrency(displayTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comisión</p>
                <p className="text-sm font-medium">{policyAny.commission_pct || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* CLIENTE (compacto) */}
        {/* ============================================= */}
        {policy.client && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building className="w-4 h-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        {/* NOTAS */}
        {/* ============================================= */}
        {policyAny.notas && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4" />
                Notas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-xs whitespace-pre-wrap">{policyAny.notas}</p>
            </CardContent>
          </Card>
        )}

        {/* ============================================= */}
        {/* REGISTRO */}
        {/* ============================================= */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              Registro
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
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

        {/* ============================================= */}
        {/* HISTORIAL DE VIGENCIAS */}
        {/* ============================================= */}
        <RenewalHistory policyId={policyId} tenantId={tenantId || ''} />

        {/* ============================================= */}
        {/* TABLA DE ANEXOS (solo en póliza principal) */}
        {/* ============================================= */}
        {!isAnexo && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="w-4 h-4" />
                Anexos ({anexos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {anexos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No hay anexos para esta póliza</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Anexo</TableHead>
                        <TableHead className="text-xs">Prima</TableHead>
                        <TableHead className="text-xs">Vigencia Desde</TableHead>
                        <TableHead className="text-xs">Vigencia Hasta</TableHead>
                        <TableHead className="text-xs">Estado</TableHead>
                        <TableHead className="text-xs">Creado</TableHead>
                        <TableHead className="text-xs">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {anexos.map((anexo) => (
                        <TableRow key={anexo.id}>
                          <TableCell className="text-xs font-medium">{anexo.anexo}</TableCell>
                          <TableCell className={`text-xs ${anexo.premium < 0 ? 'text-red-600' : ''}`}>
                            {formatCurrency(anexo.premium)}
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(anexo.start_date)}</TableCell>
                          <TableCell className="text-xs">{formatDate(anexo.end_date)}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${POLICY_STATUS_COLORS[anexo.status as PolicyStatus]}`}>
                              {POLICY_STATUS_LABELS[anexo.status as PolicyStatus] || anexo.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(anexo.created_at)}</TableCell>
                          <TableCell>
                            <Link href={`/polizas/${anexo.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ============================================= */}
      {/* DIALOG: ADJUNTAR DOCUMENTOS */}
      {/* ============================================= */}
      <Dialog open={showDocPanel} onOpenChange={setShowDocPanel}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Documentos {isAnexo ? `(Anexo ${policyAny.anexo})` : 'de la Póliza'}
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
                <h4 className="text-sm font-semibold mb-2">Copia {isAnexo ? 'del Anexo' : 'de la Póliza'}</h4>
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
                      Subir copia
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
