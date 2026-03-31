'use client';

// =====================================================
// PÁGINA: Lista de Pólizas
// /polizas
// NOTA: Solo muestra pólizas base (anexo 00), con prima consolidada
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Layers
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
}

interface PolicyStats {
  total: number;
  active: number;
  byStatus: Record<string, number>;
  byLine: Record<string, number>;
  totalPremium: number;
  expiringThisMonth: number;
}

export default function PoliciesPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();

  const [policies, setPolicies] = useState<PolicyWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [lineFilter, setLineFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<PolicyStats | null>(null);

  const loadPolicies = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      let query = supabase
        .from('policies')
        .select(`
          *,
          clients!inner(full_name),
          insurance_line:insurance_lines(id, name, slug)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .or('anexo.eq.00,anexo.is.null')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (searchQuery) {
        query = query.or(`policy_number.ilike.%${searchQuery}%,insurer.ilike.%${searchQuery}%`);
      }
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
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

      const mappedPolicies = (data || []).map((p: Record<string, unknown>) => {
        const policyNumber = p.policy_number as string;
        const consolidated = consolidatedPremiums[policyNumber];

        return {
          ...p,
          client_name: (p.clients as { full_name: string })?.full_name,
          insurance_line: p.insurance_line as PolicyWithRelations['insurance_line'],
          consolidated_premium: consolidated?.premium || (p.premium as number) || 0,
          anexo_count: consolidated?.count || 0
        };
      }) as PolicyWithRelations[];

      setPolicies(mappedPolicies);
      setTotal(count || 0);

    } catch (error) {
      console.error('Error loading policies:', error);
    }
    setIsLoading(false);
  }, [tenantId, page, pageSize, searchQuery, statusFilter, lineFilter]);

  const loadStats = useCallback(async () => {
    if (!tenantId) return;

    try {
      const supabase = getBrowserClient();

      const { data: allPolicies } = await supabase
        .from('policies')
        .select('policy_number, status, line, premium, end_date, anexo')
        .eq('tenant_id', tenantId);

      if (allPolicies) {
        const policyGroups: Record<string, { status: string; line: string; totalPremium: number; end_date: string | null; isBase: boolean; }> = {};

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
        let expiringThisMonth = 0;

        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);

        basePolicies.forEach(p => {
          byStatus[p.status] = (byStatus[p.status] || 0) + 1;
          byLine[p.line] = (byLine[p.line] || 0) + 1;
          totalPremium += p.totalPremium;
          if (p.status === 'activa') active++;
          if (p.end_date && new Date(p.end_date) <= endOfMonth) expiringThisMonth++;
        });

        setStats({
          total: basePolicies.length,
          active,
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
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            <Layers className="h-2.5 w-2.5 mr-0.5" />
            {anexoCount}
          </Badge>
        )}
      </div>
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
            <h1 className="text-2xl font-bold text-slate-900">Polizas</h1>
            <p className="text-sm text-muted-foreground">{tenantName}</p>
          </div>
        </div>
        <Link href="/polizas/nueva">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Poliza
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Polizas</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Activas</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Prima Total Consolidada</p>
              <p className={`text-3xl font-bold ${stats.totalPremium < 0 ? 'text-red-600' : ''}`}>
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
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero o aseguradora..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-policies-input"
          />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(POLICY_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lineFilter || 'all'} onValueChange={(v) => setLineFilter(v === 'all' ? undefined : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los ramos</SelectItem>
            {Object.entries(POLICY_LINE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingScreen />
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No se encontraron polizas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="text-xs">Numero</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Aseguradora</TableHead>
                  <TableHead className="text-xs">Ramo</TableHead>
                  <TableHead className="text-xs">Prima Consolidada</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Vencimiento</TableHead>
                  <TableHead className="text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id} className="text-xs">
                    <TableCell className="py-2 font-medium text-xs">{policy.policy_number}</TableCell>
                    <TableCell className="py-2 text-xs">{policy.client_name || 'N/A'}</TableCell>
                    <TableCell className="py-2 text-xs">{policy.insurer}</TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {policy.insurance_line?.name || POLICY_LINE_LABELS[policy.line as PolicyLine] || policy.line || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {formatPremiumDisplay(policy.consolidated_premium || policy.premium, policy.anexo_count)}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge className={`text-[10px] ${POLICY_STATUS_COLORS[policy.status as PolicyStatus]}`}>
                        {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs">{formatDate(policy.end_date)}</TableCell>
                    <TableCell className="py-2 text-right">
                      <Link href={`/polizas/${policy.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Pagina {page} de {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
