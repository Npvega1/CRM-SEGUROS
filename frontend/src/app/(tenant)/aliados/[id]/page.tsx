'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { getAlliedAgentById } from '@/lib/services/allied-agents.service';
import { IDENTIFICATION_TYPES } from '@/types/allied-agents';
import type { AlliedAgent } from '@/types/allied-agents';
import {
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  formatClaimAmount,
  formatClaimDate,
  type ClaimStatus
} from '@/lib/validations/claims';
import {
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatPremium,
  formatDate,
  type PolicyStatus,
  type PolicyLine
} from '@/lib/validations/policies';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Shield,
  AlertTriangle,
  FolderOpen,
  Users,
  Clock,
  Download,
  Building,
  Eye
} from 'lucide-react';

interface ClientBasic {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  segment: string;
}

interface PolicyBasic {
  id: string;
  policy_number: string;
  insurer: string;
  line: string;
  status: string;
  start_date: string;
  end_date: string;
  premium: number;
  currency: string;
  clients?: { full_name: string };
}

interface ClaimBasic {
  id: string;
  status: string;
  incident_date: string;
  claimed_amount: number;
  approved_amount: number | null;
  policies?: { policy_number: string; insurer: string };
  clients?: { full_name: string };
}

export default function AllyDetailPage() {
  const params = useParams();
  const allyId = params.id as string;
  const { isLoading: isLoadingTenant, tenantId } = useTenant();

  const [ally, setAlly] = useState<AlliedAgent | null>(null);
  const [clients, setClients] = useState<ClientBasic[]>([]);
  const [policies, setPolicies] = useState<PolicyBasic[]>([]);
  const [claims, setClaims] = useState<ClaimBasic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!tenantId || !allyId) return;

    setIsLoading(true);
    try {
      // 1. Cargar datos del aliado
      const allyData = await getAlliedAgentById(allyId);
      setAlly(allyData);

      if (!allyData) {
        setIsLoading(false);
        return;
      }

      const supabase = getBrowserClient();

      // 2. Cargar clientes del aliado
      const { data: clientsData } = await (supabase as any)
        .from('clients')
        .select('id, full_name, email, phone, segment')
        .eq('tenant_id', tenantId)
        .eq('allied_agent_id', allyId)
        .order('full_name');

      const clientsList = (clientsData || []) as ClientBasic[];
      setClients(clientsList);

      // 3. Cargar pólizas de esos clientes
      if (clientsList.length > 0) {
        const clientIds = clientsList.map(c => c.id);

        const { data: policiesData } = await (supabase as any)
          .from('policies')
          .select('id, policy_number, insurer, line, status, start_date, end_date, premium, currency, clients(full_name)')
          .eq('tenant_id', tenantId)
          .in('client_id', clientIds)
          .order('start_date', { ascending: false });

        setPolicies((policiesData || []) as PolicyBasic[]);

        // 4. Cargar siniestros de esos clientes
        const { data: claimsData } = await (supabase as any)
          .from('claims')
          .select('id, status, incident_date, claimed_amount, approved_amount, policies(policy_number, insurer), clients(full_name)')
          .eq('tenant_id', tenantId)
          .in('client_id', clientIds)
          .order('created_at', { ascending: false });

        setClaims((claimsData || []) as ClaimBasic[]);
      }
    } catch (error) {
      console.error('Error loading ally data:', error);
    }
    setIsLoading(false);
  }, [tenantId, allyId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadData();
    }
  }, [isLoadingTenant, tenantId, loadData]);

  const handleDownloadDocument = async (path: string) => {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.storage
        .from('allied-agent-documents')
        .createSignedUrl(path, 60);
      if (error || !data?.signedUrl) return;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando datos del aliado..." />;
  }

  if (!ally) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aliado no encontrado</h2>
            <Link href="/aliados">
              <Button>Volver a Aliados</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const idTypeLabel = IDENTIFICATION_TYPES.find(t => t.value === ally.identification_type)?.label || ally.identification_type?.toUpperCase() || 'CC';
  const activePolicies = policies.filter(p => p.status === 'activa');
  const totalPremium = activePolicies.reduce((sum, p) => sum + Number(p.premium), 0);

  // Documentos existentes del aliado
  const allyDocuments: { label: string; path: string | null | undefined }[] = [
    { label: 'Cédula', path: ally.document_cedula },
    { label: 'Certificación Bancaria', path: ally.document_bank_certificate },
    { label: 'RUT', path: ally.document_rut },
    { label: 'Otro', path: ally.document_other },
  ].filter(d => d.path);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/aliados">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Vista 360° - Aliado</h1>
          <p className="text-sm text-muted-foreground">{ally.full_name}</p>
        </div>
      </div>

      {/* Info del Aliado */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{ally.full_name}</h2>
                {ally.is_active ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-xs">Activo</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {idTypeLabel}: {ally.identification}
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {ally.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="w-4 h-4" /> {ally.email}
                  </span>
                )}
                {ally.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="w-4 h-4" /> {ally.phone}
                  </span>
                )}
                {ally.city && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-4 h-4" /> {ally.city}
                  </span>
                )}
                {ally.birth_date && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-4 h-4" /> {formatDate(ally.birth_date)}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <Badge variant="secondary">Comisión: {ally.commission_percentage}% / {100 - ally.commission_percentage}% Agencia</Badge>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{clients.length}</p>
              <p className="text-sm text-muted-foreground">Clientes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{policies.length}</p>
              <p className="text-sm text-muted-foreground">Pólizas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatPremium(totalPremium)}</p>
              <p className="text-sm text-muted-foreground">Prima Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{claims.length}</p>
              <p className="text-sm text-muted-foreground">Siniestros</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="clientes" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clientes" className="gap-1 text-xs sm:text-sm">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="polizas" className="gap-1 text-xs sm:text-sm">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Pólizas</span>
          </TabsTrigger>
          <TabsTrigger value="siniestros" className="gap-1 text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Siniestros</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1 text-xs sm:text-sm">
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Clientes */}
        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle>Clientes del Aliado</CardTitle>
              <CardDescription>Clientes asignados a {ally.full_name}</CardDescription>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay clientes asignados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <Link key={client.id} href={`/clientes/${client.id}`}>
                      <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{client.full_name}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                            {client.email && <span>{client.email}</span>}
                            {client.phone && <span>{client.phone}</span>}
                          </div>
                        </div>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Pólizas */}
        <TabsContent value="polizas">
          <Card>
            <CardHeader>
              <CardTitle>Pólizas</CardTitle>
              <CardDescription>Pólizas de los clientes del aliado</CardDescription>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay pólizas registradas</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {policies.map((policy) => (
                    <Link key={policy.id} href={`/polizas/${policy.id}`}>
                      <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">#{policy.policy_number}</span>
                          <Badge className={`text-xs ${POLICY_STATUS_COLORS[policy.status as PolicyStatus]}`}>
                            {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building className="w-3 h-3" />
                          <span className="truncate">{policy.insurer}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cliente: {policy.clients?.full_name || 'N/A'}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(policy.start_date)} - {formatDate(policy.end_date)}
                          </span>
                          <span className="text-sm font-semibold">
                            {formatPremium(Number(policy.premium), policy.currency)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Siniestros */}
        <TabsContent value="siniestros">
          <Card>
            <CardHeader>
              <CardTitle>Siniestros</CardTitle>
              <CardDescription>Siniestros de los clientes del aliado</CardDescription>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay siniestros registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((claim) => (
                    <Link key={claim.id} href={`/siniestros/${claim.id}`}>
                      <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">
                            Póliza #{claim.policies?.policy_number || 'N/A'}
                          </span>
                          <Badge className={`text-xs ${CLAIM_STATUS_COLORS[claim.status as ClaimStatus]}`}>
                            {CLAIM_STATUS_LABELS[claim.status as ClaimStatus]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cliente: {claim.clients?.full_name || 'N/A'} | {formatClaimDate(claim.incident_date)}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
                          <span className="text-xs text-muted-foreground">
                            Reclamado: {formatClaimAmount(claim.claimed_amount)}
                          </span>
                          {claim.approved_amount != null && (
                            <span className="text-xs text-green-600 font-medium">
                              Aprobado: {formatClaimAmount(claim.approved_amount)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle>Documentos del Aliado</CardTitle>
              <CardDescription>Archivos adjuntos del aliado</CardDescription>
            </CardHeader>
            <CardContent>
              {allyDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay documentos cargados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allyDocuments.map((doc) => (
                    <div
                      key={doc.label}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{doc.label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {doc.path?.split('/').pop()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => doc.path && handleDownloadDocument(doc.path)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
