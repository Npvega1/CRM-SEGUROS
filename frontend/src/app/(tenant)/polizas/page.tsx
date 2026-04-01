'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

interface StatusCount {
  all: number;
  activa: number;
  no_renovada: number;
  vencida: number;
  cancelada: number;
}

export default function PoliciesPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();

  const [policies, setPolicies] = useState<PolicyWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<StatusCount>({ all: 0, activa: 0, no_renovada: 0, vencida: 0, cancelada: 0 });

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
  }, [tenantId, page, pageSize, searchQuery, statusFilter]);

  const loadStatusCounts = useCallback(async () => {
    if (!tenantId) return;

    try {
      const supabase = getBrowserClient();

      const { data } = await supabase
        .from('policies')
        .select('status')
        .eq('tenant_id', tenantId)
        .or('anexo.eq.00,anexo.is.null');

      if (data) {
        let activa = 0, no_renovada = 0, vencida = 0, cancelada = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.forEach((p: any) => {
          if (p.status === 'activa') activa++;
          else if (p.status === 'no_renovada') no_renovada++;
          else if (p.status === 'vencida') vencida++;
          else if (p.status === 'cancelada') cancelada++;
        });
        setStatusCounts({ all: data.length, activa, no_renovada, vencida, cancelada });
      }
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadPolicies();
      loadStatusCounts();
    }
  }, [isLoadingTenant, tenantId, loadPolicies, loadStatusCounts]);

  const totalPages = Math.ceil(total / pageSize);

  const formatPremiumDisplay = (value: number, anexoCount?: number) => {
    const isNegative = value < 0;
    const formatted = formatPremium(value);
    return (
      <span className={`inline-flex items-center gap-1 ${isNegative ? 'text-red-600' : ''}`}>
        {formatted}
        {typeof anexoCount === 'number' && anexoCount > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            <Layers className="w-2.5 h-2.5 mr-0.5" />{anexoCount}
          </Badge>
        )}
      </span>
    );
  };

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col h-full" data-testid="polizas-page">
      {/* Header fijo */}
      <div className="flex-shrink-0 p-4 md:p-6 pb-0 space-y-4 bg-background">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Polizas</h1>
            <p className="text-sm text-muted-foreground">{tenantName}</p>
          </div>
          <Link href="/polizas/nueva">
            <Button className="gap-2" data-testid="new-policy-button">
              <Plus className="w-4 h-4" />
              Nueva Poliza
            </Button>
          </Link>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Todas', count: statusCounts.all },
            { key: 'activa', label: 'Activas', count: statusCounts.activa },
            { key: 'no_renovada', label: 'No renovadas', count: statusCounts.no_renovada },
            { key: 'vencida', label: 'Inactivas', count: statusCounts.vencida },
            { key: 'cancelada', label: 'Canceladas', count: statusCounts.cancelada },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key === 'all' ? undefined : tab.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                (statusFilter || 'all') === tab.key
                  ? 'bg-slate-200 text-slate-800 ring-1 ring-slate-400'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero o aseguradora..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-policies-input"
          />
        </div>
      </div>

      {/* Tabla scrolleable */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 pt-4">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <FileText className="w-8 h-8 animate-pulse text-muted-foreground" />
              </div>
            ) : policies.length === 0 ? (
              <div className="text-center text-muted-foreground p-12">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
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
                    <TableHead className="text-xs text-right">Prima Consolidada</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Vencimiento</TableHead>
                    <TableHead className="text-xs text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id} className="text-xs">
                      <TableCell className="py-2 font-medium text-xs">{policy.policy_number}</TableCell>
                      <TableCell className="py-2 text-xs whitespace-nowrap">{policy.client_name || 'N/A'}</TableCell>
                      <TableCell className="py-2 text-xs">{policy.insurer}</TableCell>
                      <TableCell className="py-2 text-xs">
                        {policy.insurance_line?.name || POLICY_LINE_LABELS[policy.line as PolicyLine] || policy.line || '-'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-right font-medium">
                        {formatPremiumDisplay(policy.consolidated_premium || policy.premium, policy.anexo_count)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={`text-[10px] ${POLICY_STATUS_COLORS[policy.status as PolicyStatus]}`}>
                          {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">{formatDate(policy.end_date)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <Link href={`/polizas/${policy.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`ver-poliza-${policy.id}`}>
                            <Eye className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Pagina {page} de {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
