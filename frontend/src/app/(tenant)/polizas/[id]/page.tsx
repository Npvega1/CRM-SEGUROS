'use client';

// =====================================================
// PÁGINA: Detalle de Póliza
// /polizas/[id]
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PolicyStatusStepper } from '@/components/modules/policies/PolicyStatusStepper';
import { PDFUploader } from '@/components/modules/policies/PDFUploader';
import { getPolicyById, getPolicyHistory, updatePolicyStatus } from '../actions';
import {
  type Policy,
  type PolicyHistory,
  type PolicyStatus,
  type PolicyLine,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatPremium,
  formatDate
} from '@/lib/validations/policies';
import {
  ArrowLeft,
  Shield,
  AlertCircle,
  Building,
  Calendar,
  Percent,
  FileText,
  History,
  User
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';

export default function PolicyDetailPage() {
  const params = useParams();
  const policyId = params.id as string;
  const { isLoading: isLoadingTenant, tenantName } = useTenant();

  const [policy, setPolicy] = useState<(Policy & { client_name?: string }) | null>(null);
  const [history, setHistory] = useState<PolicyHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setIsLoading(true);
    const result = await getPolicyById(policyId);

    if (result.success) {
      setPolicy(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [policyId]);

  const loadHistory = useCallback(async () => {
    const result = await getPolicyHistory(policyId);
    if (result.success) {
      setHistory(result.data);
    }
  }, [policyId]);

  useEffect(() => {
    if (policyId) {
      loadPolicy();
      loadHistory();
    }
  }, [policyId, loadPolicy, loadHistory]);

  const handleStatusChange = async (newStatus: PolicyStatus, note?: string) => {
    setIsUpdatingStatus(true);
    const result = await updatePolicyStatus(policyId, newStatus, note);

    if (result.success) {
      setPolicy(result.data);
      loadHistory();
    } else {
      setError(result.error.message);
    }
    setIsUpdatingStatus(false);
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando póliza..." />;
  }

  if (error || !policy) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error || 'Póliza no encontrada'}</p>
          <Link href="/polizas">
            <Button>Volver a Pólizas</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/polizas">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Detalle de Póliza</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header de la Póliza */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">#{policy.policy_number}</h1>
                  <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                    {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  {POLICY_LINE_LABELS[policy.line as PolicyLine]} • {policy.insurer}
                </p>
                {policy.client_name && (
                  <Link href={`/clientes/${policy.client_id}`}>
                    <p className="text-primary hover:underline flex items-center gap-1 mt-2">
                      <User className="w-4 h-4" />
                      {policy.client_name}
                    </p>
                  </Link>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{formatPremium(Number(policy.premium), policy.currency)}</p>
                <p className="text-sm text-muted-foreground">Prima anual</p>
              </div>
            </div>

            {/* Status Stepper */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-medium mb-3">Estado de la póliza</p>
              <PolicyStatusStepper
                currentStatus={policy.status as PolicyStatus}
                onStatusChange={handleStatusChange}
                isLoading={isUpdatingStatus}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Información Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalles de la Póliza</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Aseguradora</p>
                    <p className="font-medium flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      {policy.insurer}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Línea de Seguro</p>
                    <p className="font-medium">{POLICY_LINE_LABELS[policy.line as PolicyLine]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de Inicio</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(policy.start_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de Vencimiento</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(policy.end_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Comisión</p>
                    <p className="font-medium flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      {policy.commission_pct || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Moneda</p>
                    <p className="font-medium">{policy.currency}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Historial */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Cambios
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No hay cambios registrados</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {entry.old_status && (
                              <Badge variant="outline" className="text-xs">
                                {POLICY_STATUS_LABELS[entry.old_status as PolicyStatus]}
                              </Badge>
                            )}
                            <span>→</span>
                            <Badge className={POLICY_STATUS_COLORS[entry.new_status as PolicyStatus]}>
                              {POLICY_STATUS_LABELS[entry.new_status as PolicyStatus]}
                            </Badge>
                          </div>
                          {entry.note && (
                            <p className="text-sm text-muted-foreground mt-1">{entry.note}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(entry.changed_at).toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Documento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documento
                </CardTitle>
                <CardDescription>Documento de la póliza (PDF)</CardDescription>
              </CardHeader>
              <CardContent>
                <PDFUploader
                  policyId={policyId}
                  currentDocumentUrl={policy.document_url}
                  onUploadComplete={() => loadPolicy()}
                />
              </CardContent>
            </Card>

            {/* Acciones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/clientes/${policy.client_id}`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <User className="w-4 h-4 mr-2" />
                    Ver Cliente
                  </Button>
                </Link>
                {/* Placeholder para futuras acciones */}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
