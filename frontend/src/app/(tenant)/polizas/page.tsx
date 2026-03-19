'use client';

// =====================================================
// PÁGINA: Lista de Pólizas
// /polizas
// Usa Supabase Client directo (evita API Routes con problemas de proxy)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface ExpiringPolicy {
  id: string;
  policy_number: string;
  insurer: string;
  line: string;
  premium: number;
  end_date: string;
  days_remaining: number;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
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

  const [policies, setPolicies] = useState<Array<Policy & { client_name?: string }>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [lineFilter, setLineFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<PolicyStats | null>(null);
  const [expiringPolicies, setExpiringPolicies] = useState<ExpiringPolicy[]>([]);

  const loadPolicies = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      // Build query
      let query = supabase
        .from('policies')
        .select(`
          *,
          clients!inner(full_name)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
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
      } else {
        // Map client name
        const mappedPolicies = (data || []).map((p: Record<string, unknown>) => ({
          ...p,
          client_name: (p.clients as { full_name: string })?.full_name
        })) as Array<Policy & { client_name?: string }>;
        setPolicies(mappedPolicies);
        setTotal(count || 0);
      }
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
        .select('status, line, premium, end_date')
        .eq('tenant_id', tenantId);
      
      if (allPolicies) {
        const byStatus: Record<string, number> = {};
        const byLine: Record<string, number> = {};
        let totalPremium = 0;
        let active = 0;
        let expiringThisMonth = 0;
        
        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);
        
        allPolicies.forEach(p => {
          byStatus[p.status] = (byStatus[p.status] || 0) + 1;
          byLine[p.line] = (byLine[p.line] || 0) + 1;
          totalPremium += p.premium || 0;
          if (p.status === 'active') active++;
          if (p.end_date && new Date(p.end_date) <= endOfMonth) expiringThisMonth++;
        });
        
        setStats({
          total: allPolicies.length,
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

  const loadExpiringPolicies = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const supabase = getBrowserClient();
      
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const { data } = await supabase
        .from('policies')
        .select(`
          id, policy_number, insurer, line, premium, end_date,
          clients!inner(id, full_name, email, phone)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lte('end_date', thirtyDaysFromNow.toISOString())
        .gte('end_date', new Date().toISOString())
        .order('end_date', { ascending: true })
        .limit(5);
      
      if (data) {
        const mapped = data.map((p: Record<string, unknown>) => {
          const client = p.clients as { id: string; full_name: string; email: string | null; phone: string | null };
          const endDate = new Date(p.end_date as string);
          const today = new Date();
          const diffTime = endDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          return {
            id: p.id as string,
            policy_number: p.policy_number as string,
            insurer: p.insurer as string,
            line: p.line as string,
            premium: p.premium as number,
            end_date: p.end_date as string,
            days_remaining: diffDays,
            client_id: client.id,
            client_name: client.full_name,
            client_email: client.email,
            client_phone: client.phone
          };
        });
        setExpiringPolicies(mapped);
      }
    } catch (error) {
      console.error('Error loading expiring policies:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadPolicies();
      loadStats();
      loadExpiringPolicies();
    }
  }, [isLoadingTenant, tenantId, loadPolicies, loadStats, loadExpiringPolicies]);

  const totalPages = Math.ceil(total / pageSize);

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Pólizas
            </h1>
            <p className="text-muted-foreground">{tenantName}</p>
          </div>
        </div>
        <Link href="/polizas/nuevo">
          <Button data-testid="new-policy-btn">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Póliza
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Pólizas</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Activas</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Prima Total</CardDescription>
              <CardTitle className="text-3xl">{formatPremium(stats.totalPremium)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Vencen este mes
              </CardDescription>
              <CardTitle className="text-3xl text-amber-600">{stats.expiringThisMonth}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Expiring Policies Alert */}
      {expiringPolicies.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Clock className="h-5 w-5" />
              Pólizas Próximas a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringPolicies.map(policy => (
                <div key={policy.id} className="flex items-center justify-between p-2 bg-background rounded">
                  <div>
                    <p className="font-medium">{policy.policy_number}</p>
                    <p className="text-sm text-muted-foreground">{policy.client_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={policy.days_remaining <= 7 ? "destructive" : "secondary"}>
                      {policy.days_remaining} días
                    </Badge>
                    <p className="text-sm text-muted-foreground">{formatDate(policy.end_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o aseguradora..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-policies-input"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No se encontraron pólizas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Aseguradora</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Prima</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id} data-testid={`policy-row-${policy.id}`}>
                    <TableCell className="font-medium">{policy.policy_number}</TableCell>
                    <TableCell>{policy.client_name || 'N/A'}</TableCell>
                    <TableCell>{policy.insurer}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{POLICY_LINE_LABELS[policy.line as PolicyLine]}</Badge>
                    </TableCell>
                    <TableCell>{formatPremium(policy.premium)}</TableCell>
                    <TableCell>
                      <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                        {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(policy.end_date)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/polizas/${policy.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
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
