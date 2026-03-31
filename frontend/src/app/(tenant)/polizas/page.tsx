'use client';

// =====================================================
// PÁGINA: Lista de Pólizas
// /polizas
// Tabs: Activas | Canceladas | No Renovadas | Inactivas
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type Policy,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatPremium,
  formatDate,
  type PolicyStatus,
  type PolicyLine
} from '@/lib/validations/policies';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  Plus,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Shield,
  AlertTriangle,
  Layers,
  RefreshCw,
  XCircle,
  Clock,
  Archive
} from 'lucide-react';

interface PolicyWithRelations extends Policy {
  client_name?: string;
  insurance_line?: {
    id: string;
    name: string;
    slug: string;
  };
  consolidated_premium?: number;
  anexo_count?: number;
  is_renewal?: boolean;
}

interface PolicyStats {
  total: number;
  active: number;
  cancelled: number;
  not_renewed: number;
  inactive: number;
  byStatus: Record<string, number>;
  byLine: Record<string, number>;
  totalPremium: number;
  expiringThisMonth: number;
}

type TabValue = 'activas' | 'canceladas' | 'no_renovadas' | 'inactivas';

const TAB_STATUS_MAP: Record<TabValue, string[]> = {
  activas: ['activa', 'cotizacion', 'renovacion'],
  canceladas: ['cancelada'],
  no_renovadas: ['no_renovada', 'vencida'],
  inactivas: ['inactiva']
};

export default function PoliciesPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();

  const [policies, setPolicies] = useState<PolicyWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [lineFilter, setLineFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<PolicyStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('activas');

  const loadPolicies = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      const statusesForTab = TAB_STATUS_MAP[activeTab];

      // Paso 1: Cargar pólizas base (anexo 00 o null) filtradas por tab
      let query = supabase
        .from('policies')
        .select(`
          *,
          clients!inner(full_name),
          insurance_line:insurance_lines(id, name, slug)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .or('anexo.eq.00,anexo.is.null')
        .in('status', statusesForTab)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (searchQuery) {
        query = query.or(`policy_number.ilike.%${searchQuery}%,insurer.ilike.%${searchQuery}%`);
      }
      if (lineFilter && lineFilter !== 'all') {
        query = query.eq('line', lineFilter);
      }

      const { data, count, error } = await query;

      if (error) {
        console.error('Error loading policies:', error);
        setIsLoading(false);
        return;
      }

      // Paso 2: Obtener policy_numbers para calcular primas consolidadas
      const policyNumbers = (data || []).map((p: Record<string, unknown>) => p.policy_number as string);

      let consolidatedPremiums: Record<string, { premium: number; count: number }> = {};

      if (policyNumbers.length > 0) {
        const { data: allRelatedPolicies } = await supabase
          .from('policies')
          .select('policy_number, premium, anexo')
          .eq('tenant_id', tenantId)
          .in('policy_number', policyNumbers);

        if (allRelatedPolicies) {
          allRelatedPolicies.forEach((p: Record<string, unknown>) => {
            const pn = p.policy_number as string;
            const premium = (p.premium as number) || 0;
            const anexo = p.anexo as string;

            if (!consolidatedPremiums[pn]) {
              consolidatedPremiums[pn] = { premium: 0, count: 0 };
            }
            consolidatedPremiums[pn].premium += premium;

            if (anexo && anexo !== '00') {
              consolidatedPremiums[pn].count += 1;
            }
          });
        }
      }

      // Paso 3: Mapear pólizas
      const mappedPolicies = (data || []).map((p: Record<string, unknown>) => {
        const policyNumber = p.policy_number as string;
        const consolidated = consolidatedPremiums[policyNumber];
        const policyType = p.policy_type as string | null;
        const renewedFrom = p.renewed_from_policy_id as string | null;

        return {
          ...p,
          client_name: (p.clients as { full_name: string })?.full_name,
          insurance_line: p.insurance_line as PolicyWithRelations['insurance_line'],
          consolidated_premium: consolidated?.premium || (p.premium as number) || 0,
          anexo_count: consolidated?.count || 0,
          is_renewal: policyType === 'renovacion' || !!renewedFrom
        };
      }) as PolicyWithRelations[];

      setPolicies(mappedPolicies);
      setTotal(count || 0);

    } catch (error) {
      console.error('Error loading policies:', error);
    }
    setIsLoading(false);
  }, [tenantId, page, pageSize, searchQuery, lineFilter, activeTab]);

  const loadStats = useCallback(async () => {
    if (!tenantId) return;

    try {
      const supabase = getBrowserClient();

      const { data: allPolicies } = await supabase
        .from('policies')
        .select('policy_number, status, line, premium, end_date, anexo')
        .eq('tenant_id', tenantId);

      if (allPolicies) {
        const policyGroups: Record<string, {
          status: string;
          line: string;
          totalPremium: number;
          end_date: string | null;
          isBase: boolean;
        }> = {};

        allPolicies.forEach((p: Record<string, unknown>) => {
          const pn = p.policy_number as string;
          const anexo = p.anexo as string;
          const isBase = !anexo || anexo === '00';

          if (!policyGroups[pn]) {
            policyGroups[pn] = {
              status: p.status as string,
              line: p.line as string,
              totalPremium: 0,
              end_date: p.end_date as string | null,
              isBase: false
            };
          }

          policyGroups[pn].totalPremium += (p.premium as number) || 0;

          if (isBase) {
            policyGroups[pn].status = p.status as string;
            policyGroups[pn].line = p.line as string;
            policyGroups[pn].end_date = p.end_date as string | null;
            policyGroups[pn].isBase = true;
          }
        });

        const basePolicies = Object.values(policyGroups).filter(p => p.isBase);

        const byStatus: Record<string, number> = {};
        const byLine: Record<string, number> = {};
        let totalPremium = 0;
        let active = 0;
        let cancelled = 0;
        let notRenewed = 0;
        let inactive = 0;
        let expiringThisMonth = 0;

        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);

        basePolicies.forEach(p => {
          byStatus[p.status] = (byStatus[p.status] || 0) + 1;
          byLine[p.line] = (byLine[p.line] || 0) + 1;

          if (p.status === 'activa' || p.status === 'cotizacion' || p.status === 'renovacion') {
            totalPremium += p.totalPremium;
            active++;
          }
          if (p.status === 'cancelada') cancelled++;
          if (p.status === 'no_renovada' || p.status === 'vencida') notRenewed++;
          if (p.status === 'inactiva') inactive++;

          if (p.status === 'activa' && p.end_date && new Date(p.end_date) <= endOfMonth) {
            expiringThisMonth++;
          }
        });

        setStats({
          total: basePolicies.length,
          active,
          cancelled,
          not_renewed: notRenewed,
          inactive,
          byStatus,
          byLine,
          totalPremium,
          expiringThisMonth
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadPolicies();
      loadStats();
    }
  }, [isLoadingTenant, tenantId, loadPolicies, loadStats]);

  // Reset page cuando cambia tab
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const totalPages = Math.ceil(total / pageSize);

  const formatPremiumDisplay = (value: number, anexoCount?: number) => {
    const isNegative = value < 0;
    const formatted = formatPremium(value);
    return (
      <div className="flex items-center gap-1">
        <span className={isNegative ? 'text-red-600' : ''}>
          {formatted}
        </span>
        {typeof anexoCount === 'number' && anexoCount > 0 && (
          <Badge variant="outline" className="text-xs px-1 py-0">
            <Layers className="h-3 w-3 mr-1" />
            {anexoCount}
          </Badge>
        )}
      </div>
    );
  };

  // Columnas de la tabla según el tab
  const getTableHeaders = () => {
    if (activeTab === 'no_renovadas') {
      return (
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Aseguradora</TableHead>
          <TableHead>Ramo</TableHead>
          <TableHead>Prima</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Venció</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      );
    }
    if (activeTab === 'inactivas') {
      return (
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Aseguradora</TableHead>
          <TableHead>Ramo</TableHead>
          <TableHead>Prima</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Vigencia</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      );
    }
    return (
      <TableRow>
        <TableHead>Número</TableHead>
        <TableHead>Cliente</TableHead>
        <TableHead>Aseguradora</TableHead>
        <TableHead>Ramo</TableHead>
        <TableHead>Prima Consolidada</TableHead>
        <TableHead>Estado</TableHead>
        <TableHead>Vencimiento</TableHead>
        <TableHead className="text-right">Acciones</TableHead>
      </TableRow>
    );
  };

  const getTableRow = (policy: PolicyWithRelations) => {
    const vigenciaLabel = activeTab === 'inactivas'
      ? `${formatDate(policy.start_date)} - ${formatDate(policy.end_date)}`
      : formatDate(policy.end_date);

    return (
      <TableRow key={policy.id}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {policy.policy_number}
            {policy.is_renewal && activeTab === 'activas' && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 text-blue-700 border-blue-300 bg-blue-50">
                <RefreshCw className="h-3 w-3 mr-1" />
                Renovación
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>{policy.client_name || 'N/A'}</TableCell>
        <TableCell>{policy.insurer}</TableCell>
        <TableCell>
          <Badge variant="outline">
            {policy.insurance_line?.name || POLICY_LINE_LABELS[policy.line as PolicyLine] || policy.line || '-'}
          </Badge>
        </TableCell>
        <TableCell>
          {formatPremiumDisplay(
            activeTab === 'activas' ? (policy.consolidated_premium || policy.premium) : policy.premium,
            activeTab === 'activas' ? policy.anexo_count : undefined
          )}
        </TableCell>
        <TableCell>
          <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
            {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
          </Badge>
        </TableCell>
        <TableCell>{vigenciaLabel}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Link href={`/polizas/${policy.id}`}>
              <Button variant="ghost" size="icon">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {activeTab === 'no_renovadas' && (
              <Link href={`/polizas/renovar?poliza=${policy.id}`}>
                <Button variant="ghost" size="icon" title="Renovar">
                  <RefreshCw className="h-4 w-4 text-blue-600" />
                </Button>
              </Link>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pólizas</h1>
            <p className="text-sm text-muted-foreground">{tenantName}</p>
          </div>
        </div>
        <Link href="/polizas/nueva">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Póliza
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Activas</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Prima Activa</p>
              <p className={`text-2xl font-bold ${stats.totalPremium < 0 ? 'text-red-600' : ''}`}>
                {formatPremium(stats.totalPremium)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Vencen este mes
              </p>
              <p className="text-3xl font-bold text-amber-600">{stats.expiringThisMonth}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No Renovadas</p>
              <p className="text-3xl font-bold text-orange-600">{stats.not_renewed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Inactivas</p>
              <p className="text-3xl font-bold text-purple-600">{stats.inactive}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="activas" className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            Activas
            {stats && <Badge variant="secondary" className="ml-1 text-xs">{stats.active}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="canceladas" className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4" />
            Canceladas
            {stats && stats.cancelled > 0 && <Badge variant="secondary" className="ml-1 text-xs">{stats.cancelled}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="no_renovadas" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            No Renovadas
            {stats && stats.not_renewed > 0 && <Badge variant="secondary" className="ml-1 text-xs">{stats.not_renewed}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="inactivas" className="flex items-center gap-1.5">
            <Archive className="h-4 w-4" />
            Inactivas
            {stats && stats.inactive > 0 && <Badge variant="secondary" className="ml-1 text-xs">{stats.inactive}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Filters - shared across all tabs */}
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número o aseguradora..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-policies-input"
            />
          </div>
          <Select value={lineFilter || 'all'} onValueChange={(v) => setLineFilter(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Ramo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los ramos</SelectItem>
              {Object.entries(POLICY_LINE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table content - same for all tabs */}
        {['activas', 'canceladas', 'no_renovadas', 'inactivas'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingScreen />
                  </div>
                ) : policies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4" />
                    <p>
                      {tab === 'activas' && 'No hay pólizas activas'}
                      {tab === 'canceladas' && 'No hay pólizas canceladas'}
                      {tab === 'no_renovadas' && 'No hay pólizas sin renovar'}
                      {tab === 'inactivas' && 'No hay pólizas inactivas'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      {getTableHeaders()}
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => getTableRow(policy))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
