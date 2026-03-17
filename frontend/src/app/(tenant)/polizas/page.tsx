'use client';

// =====================================================
// PÁGINA: Lista de Pólizas
// /polizas
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
import { listPolicies, getPolicyStats, getExpiringPolicies } from './actions';
import {
  type Policy,
  type ExpiringPolicy,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatPremium,
  formatDate,
  type PolicyStatus,
  type PolicyLine
} from '@/lib/validations/policies';
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

export default function PoliciesPage() {
  const { isLoading: isLoadingTenant, tenantName } = useTenant();

  const [policies, setPolicies] = useState<Array<Policy & { client_name?: string }>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [lineFilter, setLineFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    byStatus: Record<string, number>;
    byLine: Record<string, number>;
    totalPremium: number;
    expiringThisMonth: number;
  } | null>(null);
  const [expiringPolicies, setExpiringPolicies] = useState<ExpiringPolicy[]>([]);

  const loadPolicies = useCallback(async () => {
    setIsLoading(true);
    const result = await listPolicies({
      page,
      pageSize,
      search: searchQuery || undefined,
      status: statusFilter,
      line: lineFilter
    });

    if (result.success) {
      setPolicies(result.data.policies);
      setTotal(result.data.total);
    }
    setIsLoading(false);
  }, [page, pageSize, searchQuery, statusFilter, lineFilter]);

  const loadStats = useCallback(async () => {
    const result = await getPolicyStats();
    if (result.success) {
      setStats(result.data);
    }
  }, []);

  const loadExpiringPolicies = useCallback(async () => {
    const result = await getExpiringPolicies([5, 15, 30]);
    if (result.success) {
      setExpiringPolicies(result.data);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  useEffect(() => {
    loadStats();
    loadExpiringPolicies();
  }, [loadStats, loadExpiringPolicies]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadPolicies();
  };

  const totalPages = Math.ceil(total / pageSize);

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Gestión de Pólizas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pólizas</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <FileText className="w-8 h-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Activas</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.active || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Prima Total</p>
                  <p className="text-2xl font-bold">{formatPremium(stats?.totalPremium || 0)}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className={expiringPolicies.length > 0 ? 'border-yellow-300 bg-yellow-50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Por Vencer</p>
                  <p className="text-2xl font-bold text-yellow-600">{expiringPolicies.length}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Vencimiento */}
        {expiringPolicies.length > 0 && (
          <Card className="mb-8 border-yellow-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Pólizas Próximas a Vencer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringPolicies.slice(0, 5).map((policy) => (
                  <Link key={policy.id} href={`/polizas/${policy.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-yellow-100 transition-colors">
                      <div>
                        <span className="font-medium">#{policy.policy_number}</span>
                        <span className="text-muted-foreground ml-2">- {policy.client_name}</span>
                      </div>
                      <Badge variant="warning">
                        {policy.days_until_expiry} días
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla de Pólizas */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Pólizas</CardTitle>
                <CardDescription>Gestiona todas las pólizas de tus clientes</CardDescription>
              </div>
              <Link href="/polizas/nueva">
                <Button data-testid="new-policy-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Póliza
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <form onSubmit={handleSearch} className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número o aseguradora..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="policies-search-input"
                  />
                </div>
              </form>

              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => {
                  setStatusFilter(value === 'all' ? undefined : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(Object.entries(POLICY_STATUS_LABELS) as [PolicyStatus, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={lineFilter || 'all'}
                onValueChange={(value) => {
                  setLineFilter(value === 'all' ? undefined : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Línea" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las líneas</SelectItem>
                  {(Object.entries(POLICY_LINE_LABELS) as [PolicyLine, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabla */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Aseguradora</TableHead>
                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Prima</TableHead>
                    <TableHead className="hidden lg:table-cell">Vencimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          <span className="ml-2">Cargando...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : policies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No se encontraron pólizas
                      </TableCell>
                    </TableRow>
                  ) : (
                    policies.map((policy) => (
                      <TableRow key={policy.id} data-testid={`policy-row-${policy.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">#{policy.policy_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {POLICY_LINE_LABELS[policy.line as PolicyLine]}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {policy.client_name ? (
                            <Link href={`/clientes/${policy.client_id}`} className="hover:underline">
                              {policy.client_name}
                            </Link>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{policy.insurer}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                            {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {formatPremium(Number(policy.premium), policy.currency)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {formatDate(policy.end_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/polizas/${policy.id}`}>
                            <Button variant="ghost" size="icon" data-testid={`view-policy-${policy.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} pólizas
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">Página {page} de {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
