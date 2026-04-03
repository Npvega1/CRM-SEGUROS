'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Clock
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
// COMPONENTE PRINCIPAL
// =====================================================
export default function DetallePolizaPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId, slug } = useTenant();
  const supabase = createClient();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

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
      toast.error('Error al cargar la poliza');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPolicy();
  }, [policyId, tenantId]);

  // =====================================================
  // Cambiar estado de la poliza
  // =====================================================
  const handleStatusChange = async (newStatus: PolicyStatus, note?: string) => {
    if (!policyId || !tenantId) return;
    setStatusLoading(true);

    try {
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
    } catch (err: any) {
      console.error('Error changing status:', err);
      toast.error(err.message || 'Error al cambiar estado');
    } finally {
      setStatusLoading(false);
    }
  };

  // =====================================================
  // Eliminar poliza
  // =====================================================
  const handleDelete = async () => {
    if (!confirm('Estas seguro de eliminar esta poliza? Esta accion no se puede deshacer.')) return;

    try {
      const { error } = await (supabase as any)
        .from('policies')
        .delete()
        .eq('id', policyId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast.success('Poliza eliminada');
      router.push(`/${slug}/polizas`);
    } catch (err: any) {
      console.error('Error deleting policy:', err);
      toast.error(err.message || 'Error al eliminar la poliza');
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
          <p className="text-muted-foreground">Poliza no encontrada</p>
          <Link href={`/${slug}/polizas`}>
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Polizas
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
          <Link href={`/${slug}/polizas`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                Poliza {policy.policy_number}
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

        {/* 4 Botones visibles (sin DropdownMenu de 3 puntos) */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/${slug}/polizas/${policyId}/editar`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </Link>
          {policy.document_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={policy.document_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Funcion de renovacion proximamente')}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Renovar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* ============================================= */}
      {/* STATUS STEPPER */}
      {/* ============================================= */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <PolicyStatusStepper
            currentStatus={policy.status as PolicyStatus}
            onStatusChange={handleStatusChange}
            isLoading={statusLoading}
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
              Detalles de la Poliza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Numero</p>
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
                <p className="text-sm text-muted-foreground">Fecha Expedicion</p>
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
                <p className="text-sm text-muted-foreground">Dias de Vigencia</p>
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
                <p className="text-sm text-muted-foreground">Nombre / Razon Social</p>
                <p className="font-medium">
                  {policyAny.tomador_nombre || policy.client?.full_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo Identificacion</p>
                <p className="font-medium capitalize">
                  {(policyAny.tomador_tipo_identificacion || policy.client?.doc_type || '-').replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Numero Identificacion</p>
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
                  <p className="text-sm text-muted-foreground">Tipo Identificacion</p>
                  <p className="font-medium capitalize">
                    {(policyAny.asegurado_tipo_identificacion || '-').replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Numero Identificacion</p>
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
              Valores de la Poliza
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
                <p className="text-sm text-muted-foreground">Comision</p>
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
                  <p className="text-sm text-muted-foreground">Telefono</p>
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
                <p className="text-sm text-muted-foreground">Ultima Actualizacion</p>
                <p className="font-medium">{formatDate(policy.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
