'use client';

// =====================================================
// PÁGINA: Detalle de Póliza
// /polizas/[id] (Usando API Routes)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PolicyStatusStepper } from '@/components/modules/policies/PolicyStatusStepper';
import { PDFUploader } from '@/components/modules/policies/PDFUploader';
import {
  type Policy,
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
  User
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';

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
}

export default function PolicyDetailPage() {
  const params = useParams();
  const policyId = params.id as string;
  const { isLoading: isLoadingTenant, tenantName } = useTenant();

  const [policy, setPolicy] = useState<PolicyWithClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/polizas/${policyId}`);
      if (response.ok) {
        const data = await response.json();
        setPolicy(data);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Error al cargar la póliza');
      }
    } catch (err) {
      setError('Error de conexión');
    }
    setIsLoading(false);
  }, [policyId]);

  useEffect(() => {
    if (policyId) {
      loadPolicy();
    }
  }, [policyId, loadPolicy]);

  const handleStatusChange = async (newStatus: PolicyStatus) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/polizas/${policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updated = await response.json();
        setPolicy(updated);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Error al actualizar');
      }
    } catch (err) {
      setError('Error de conexión');
    }
    setIsUpdatingStatus(false);
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando póliza..." />;
  }

  if (error || !policy) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive mb-4">
              <AlertCircle className="h-5 w-5" />
              <span>{error || 'Póliza no encontrada'}</span>
            </div>
            <Link href="/polizas">
              <Button variant="outline">Volver a Pólizas</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/polizas">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-semibold">{policy.policy_number}</span>
              </div>
              <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">{tenantName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Status Stepper */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estado de la Póliza</CardTitle>
              </CardHeader>
              <CardContent>
                <PolicyStatusStepper
                  currentStatus={policy.status as PolicyStatus}
                  onStatusChange={handleStatusChange}
                  isUpdating={isUpdatingStatus}
                />
              </CardContent>
            </Card>

            {/* Policy Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalles de la Póliza</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="h-4 w-4" /> Número
                    </dt>
                    <dd className="font-medium">{policy.policy_number}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building className="h-4 w-4" /> Aseguradora
                    </dt>
                    <dd className="font-medium">{policy.insurer}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Ramo</dt>
                    <dd>
                      <Badge variant="outline">
                        {POLICY_LINE_LABELS[policy.line as PolicyLine]}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Prima</dt>
                    <dd className="font-medium text-lg">{formatPremium(policy.premium)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> Vigencia
                    </dt>
                    <dd className="font-medium">
                      {formatDate(policy.start_date)} - {formatDate(policy.end_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground flex items-center gap-1">
                      <Percent className="h-4 w-4" /> Comisión
                    </dt>
                    <dd className="font-medium">{policy.commission_pct}%</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* PDF Uploader */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Documentos</CardTitle>
                <CardDescription>Sube el PDF de la póliza</CardDescription>
              </CardHeader>
              <CardContent>
                <PDFUploader policyId={policy.id} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client Info */}
            {policy.client && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" /> Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">{policy.client.full_name}</p>
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
                    <Link href={`/clientes/${policy.client.id}`}>
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        Ver Cliente
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/polizas/${policy.id}/editar`}>
                  <Button variant="outline" className="w-full">
                    Editar Póliza
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
