'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { getBusinessGroupById } from '@/lib/services/business-groups.service';
import type { BusinessGroup } from '@/types/business-groups';
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
  formatPremium,
  formatDate,
  type PolicyStatus
} from '@/lib/validations/policies';
import {
  ArrowLeft,
  Building2,
  Phone,
  MapPin,
  Users,
  Shield,
  AlertTriangle,
  Eye,
  Clock,
  Building
} from 'lucide-react';

interface ClientBasic {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  segment: string;
  doc_number: string;
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
  client_id: string;
  clients?: { full_name: string };
}

interface ClaimBasic {
  id: string;
  status: string;
  incident_date: string;
  claimed_amount: number;
  approved_amount: number | null;
  created_at: string;
  policies?: { policy_number: string; insurer: string };
  clients?: { full_name: string };
}

export default function BusinessGroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { isLoading: isLoadingTenant, tenantId } = useTenant();

  const [group, setGroup] = useState<BusinessGroup | null>(null);
  const [clients, setClients] = useState<ClientBasic[]>([]);
  const [policies, setPolicies] = useState<PolicyBasic[]>([]);
  const [claims, setClaims] = useState<ClaimBasic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const loadData = useCallback(async () => {
    if (!tenantId || !groupId) return;

    setIsLoading(true);
    try {
      const groupData = await getBusinessGroupById(groupId);
      setGroup(groupData);

      if (!groupData) {
        setIsLoading(false);
        return;
      }

      const supabase = getBrowserClient();

      // Clientes del grupo
      const { data: clientsData } = await (supabase as any)
        .from('clients')
        .select('id, full_name, email, phone, segment, doc_number')
        .eq('tenant_id', tenantId)
        .eq('business_group_id', groupId)
        .order('full_name');

      const clientsList = (clientsData || []) as ClientBasic[];
      setClients(clientsList);

      if (clientsList.length > 0) {
        const clientIds = clientsList.map(c => c.id);

        // Pólizas
        const { data: policiesData } = await (supabase as any)
          .from('policies')
          .select('id, policy_number, insurer, line, status, start_date, end_date, premium, currency, client_id, clients(full_name)')
          .eq('tenant_id', tenantId)
          .in('client_id', clientIds)
          .order('start_date', { ascending: false });

        setPolicies((policiesData || []) as PolicyBasic[]);

        // Siniestros
        const { data: claimsData } = await (supabase as any)
          .from('claims')
          .select('id, status, incident_date, claimed_amount, approved_amount, created_at, policies(policy_number, insurer), clients(full_name)')
          .eq('tenant_id', tenantId)
          .in('client_id', clientIds)
          .order('created_at', { ascending: false });

        setClaims((claimsData || []) as ClaimBasic[]);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
    }
    setIsLoading(false);
  }, [tenantId, groupId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadData();
    }
  }, [isLoadingTenant, tenantId, loadData]);

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando grupo empresarial..." />;
  }

  if (!group) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Grupo no encontrado</h2>
            <Link href="/grupos">
              <Button>Volver a Grupos</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =====================================================
  // STATS - VIGENTE (Fila 1)
  // =====================================================
  const activePolicies = policies.filter(p => p.status === 'activa');
  const activePremium = activePolicies.reduce((sum, p) => sum + Number(p.premium), 0);
  const activeClaims = claims.filter(c => !['resolved', 'closed'].includes(c.status));
  const activeClientIds = new Set(activePolicies.map(p => p.client_id));
  const activeClientsCount = activeClientIds.size;

  // =====================================================
  // STATS - HISTÓRICO (Fila 2, filtrado por año)
  // =====================================================
  const availableYears = Array.from(new Set([
    ...policies.map(p => p.start_date ? new Date(p.start_date).getFullYear() : null),
    ...claims.map(c => c.created_at ? new Date(c.created_at).getFullYear() : null),
  ])).filter((y): y is number => y !== null).sort((a, b) => b - a);

  const selectedYearNum = parseInt(selectedYear);
  const historicalPolicies = policies.filter(p =>
    p.start_date && new Date(p.start_date).getFullYear() === selectedYearNum
  );
  const historicalPremium = historicalPolicies.reduce((sum, p) => sum + Number(p.premium), 0);
  const historicalClaims = claims.filter(c =>
    c.created_at && new Date(c.created_at).getFullYear() === selectedYearNum
  );
  const historicalClientIds = new Set(historicalPolicies.map(p => p.client_id));
  const historicalClientsCount = historicalClientIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/grupos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Vista 360° - Grupo Empresarial</h1>
          <p className="text-sm text-muted-foreground">{group.name}</p>
        </div>
      </div>

      {/* Info del Grupo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{group.name}</h2>
                {group.is_active ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-xs">Activo</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">NIT: {group.main_nit}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {group.primary_contact_name && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-4 h-4" /> {group.primary_contact_name}
                    {group.primary_contact_phone && ` - ${group.primary_contact_phone}`}
                  </span>
                )}
                {group.city && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-4 h-4" /> {group.city}
                  </span>
                )}
                {group.address && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Building className="w-4 h-4" /> {group.address}
                  </span>
                )}
              </div>
              {group.secondary_contact_name && (
                <p className="text-xs text-muted-foreground mt-2">
                  Contacto secundario: {group.secondary_contact_name}
                  {group.secondary_contact_phone && ` - ${group.secondary_contact_phone}`}
                </p>
              )}
            </div>
          </div>

          {/* Stats - Fila 1: Vigente */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">Vigente</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{activeClientsCount}</p>
                <p className="text-sm text-muted-foreground">Clientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{activePolicies.length}</p>
                <p className="text-sm text-muted-foreground">Pólizas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{formatPremium(activePremium)}</p>
                <p className="text-sm text-muted-foreground">Prima</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{activeClaims.length}</p>
                <p className="text-sm text-muted-foreground">Siniestros</p>
              </div>
            </div>
          </div>

          {/* Stats - Fila 2: Histórico */}
          <div className="mt-4 pt-4 border-t border-dashed">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</p>
              {availableYears.length > 0 && (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{historicalClientsCount}</p>
                <p className="text-sm text-muted-foreground">Clientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{historicalPolicies.length}</p>
                <p className="text-sm text-muted-foreground">Pólizas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{formatPremium(historicalPremium)}</p>
                <p className="text-sm text-muted-foreground">Prima</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{historicalClaims.length}</p>
                <p className="text-sm text-muted-foreground">Siniestros</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="clientes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
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
        </TabsList>

        {/* Tab: Clientes */}
        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle>Clientes del Grupo</CardTitle>
              <CardDescription>Empresas y personas vinculadas a {group.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay clientes asignados a este grupo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Asigna clientes desde el formulario de edición del cliente
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <Link key={client.id} href={`/clientes/${client.id}`}>
                      <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{client.full_name}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>{client.doc_number}</span>
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
              <CardTitle>Pólizas del Grupo</CardTitle>
              <CardDescription>Todas las pólizas de los clientes del grupo</CardDescription>
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
              <CardTitle>Siniestros del Grupo</CardTitle>
              <CardDescription>Siniestros de todos los clientes del grupo</CardDescription>
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
      </Tabs>
    </div>
  );
}
