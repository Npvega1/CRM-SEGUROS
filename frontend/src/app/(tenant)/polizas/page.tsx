'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
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
  Layers,
  FileSpreadsheet
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
  inactiva: number;
  cancelada: number;
}

export default function PoliciesPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  const { isAdmin } = usePermissions();

  const [policies, setPolicies] = useState<PolicyWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('activa');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [statusCounts, setStatusCounts] = useState<StatusCount>({ all: 0, activa: 0, no_renovada: 0, inactiva: 0, cancelada: 0 });

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
      if (statusFilter) {
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
        let activa = 0, no_renovada = 0, inactiva = 0, cancelada = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.forEach((p: any) => {
          if (p.status === 'activa') activa++;
          else if (p.status === 'no_renovada') no_renovada++;
          else if (p.status === 'inactiva') inactiva++;
          else if (p.status === 'cancelada') cancelada++;
        });
        setStatusCounts({ all: data.length, activa, no_renovada, inactiva, cancelada });
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

  // =====================================================
  // Exportar a Excel (CSV UTF-8 con BOM)
  // Incluye TODAS las pólizas + anexos con toda su info
  // =====================================================
  const handleExportExcel = async () => {
    if (!tenantId) return;

    setIsExporting(true);
    try {
      const supabase = getBrowserClient();

      // 1. Traer TODAS las pólizas (incluyendo anexos)
      const { data: allPolicies, error } = await (supabase as any)
        .from('policies')
        .select(`
          *,
          clients!inner(full_name, doc_type, doc_number, email, phone),
          insurance_company:insurance_companies(id, name),
          insurance_line:insurance_lines(id, name),
          insurance_group:insurance_groups(id, name)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['activa', 'inactiva', 'no_renovada', 'cancelada'])
        .order('policy_number', { ascending: true })
        .order('anexo', { ascending: true });

      if (error || !allPolicies || allPolicies.length === 0) {
        alert('No hay pólizas para exportar.');
        setIsExporting(false);
        return;
      }

      // 2. Recopilar IDs únicos para resolver nombres
      const userIds = new Set<string>();
      const alliedAgentIds = new Set<string>();
      const grupoIds = new Set<string>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allPolicies.forEach((p: any) => {
        if (p.usuario_id) userIds.add(p.usuario_id);
        if (p.comercial_id) userIds.add(p.comercial_id);
        if (p.allied_agent_id) alliedAgentIds.add(p.allied_agent_id);
        if (p.grupo_empresarial_id) grupoIds.add(p.grupo_empresarial_id);
      });

      // 3. Batch fetch de nombres
      const userNames: Record<string, string> = {};
      const alliedNames: Record<string, string> = {};
      const grupoNames: Record<string, string> = {};

      if (userIds.size > 0) {
        const { data: usersData } = await (supabase as any)
          .from('users')
          .select('id, full_name')
          .in('id', Array.from(userIds));
        if (usersData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          usersData.forEach((u: any) => { userNames[u.id] = u.full_name || ''; });
        }
      }

      if (alliedAgentIds.size > 0) {
        const { data: agentsData } = await (supabase as any)
          .from('allied_agents')
          .select('id, full_name')
          .in('id', Array.from(alliedAgentIds));
        if (agentsData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          agentsData.forEach((a: any) => { alliedNames[a.id] = a.full_name || ''; });
        }
      }

      if (grupoIds.size > 0) {
        const { data: gruposData } = await (supabase as any)
          .from('grupos_empresariales')
          .select('id, nombre')
          .in('id', Array.from(grupoIds));
        if (gruposData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gruposData.forEach((g: any) => { grupoNames[g.id] = g.nombre || ''; });
        }
      }

      // 4. Construir filas del CSV
      const TIPO_ID_LABELS: Record<string, string> = {
        nit: 'NIT',
        cedula_ciudadania: 'Cédula de Ciudadanía',
        cedula_extranjeria: 'Cédula de Extranjería',
        pasaporte: 'Pasaporte',
        nit_extranjero: 'NIT Extranjero',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = allPolicies.map((p: any) => {
        // Beneficiarios como texto
        let beneficiariosText = '';
        if (p.beneficiarios && Array.isArray(p.beneficiarios) && p.beneficiarios.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          beneficiariosText = p.beneficiarios.map((b: any) =>
            `${b.nombre || ''} (${TIPO_ID_LABELS[b.tipo_identificacion] || b.tipo_identificacion || ''} ${b.numero_identificacion || ''})`
          ).join(' | ');
        }

        return {
          // Detalles
          'Numero Poliza': p.policy_number || '',
          'Anexo': p.anexo || '00',
          'Estado': POLICY_STATUS_LABELS[p.status as PolicyStatus] || p.status,
          'Tipo Movimiento': p.tipo_movimiento || '',
          'Cliente': p.clients?.full_name || '',
          'Aseguradora': p.insurance_company?.name || p.insurer || '',
          'Ramo': p.insurance_line?.name || p.line || '',
          'Grupo': p.insurance_group?.name || '',
          // Vigencia
          'Fecha Expedicion': p.fecha_expedicion || '',
          'Vigencia Desde': p.start_date || '',
          'Vigencia Hasta': p.end_date || '',
          'Dias Vigencia': p.dias_vigencia || '',
          // Tomador
          'Tomador Nombre': p.tomador_nombre || '',
          'Tomador Tipo ID': TIPO_ID_LABELS[p.tomador_tipo_identificacion] || p.tomador_tipo_identificacion || '',
          'Tomador Numero ID': p.tomador_numero_identificacion || '',
          // Asegurado
          'Asegurado Diferente': p.asegurado_diferente ? 'Si' : 'No',
          'Asegurado Nombre': p.asegurado_nombre || '',
          'Asegurado Tipo ID': TIPO_ID_LABELS[p.asegurado_tipo_identificacion] || p.asegurado_tipo_identificacion || '',
          'Asegurado Numero ID': p.asegurado_numero_identificacion || '',
          // Beneficiarios
          'Beneficiarios': beneficiariosText,
          // Valores
          'Valor Asegurado': p.valor_asegurado || 0,
          'Prima Neta': p.premium || 0,
          'Gastos Expedicion': p.gastos_expedicion || 0,
          'IVA': p.iva || 0,
          'Total a Pagar': p.total_a_pagar || 0,
          'Comision %': p.commission_pct || 0,
          // Gestion CRM
          'Usuario': p.usuario_id ? (userNames[p.usuario_id] || '') : '',
          'Comercial': p.comercial_id ? (userNames[p.comercial_id] || '') : '',
          'Aliado': p.allied_agent_id ? (alliedNames[p.allied_agent_id] || '') : '',
          'Comision Aliado %': p.allied_agent_pct || 0,
          'Grupo Empresarial': p.grupo_empresarial_id ? (grupoNames[p.grupo_empresarial_id] || '') : '',
          // Notas
          'Notas': p.notas || '',
        };
      });

      // 5. Generar CSV
      const headers = Object.keys(rows[0]);
      const csvContent = [
        headers.join(';'),
        ...rows.map((row: Record<string, unknown>) => headers.map(h => {
          const val = row[h];
          const str = String(val ?? '');
          if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(';'))
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `polizas_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting:', error);
    }
    setIsExporting(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatPremiumDisplay = (value: number, anexoCount?: number) => {
    const isNegative = value < 0;
    const formatted = formatPremium(value);
    return (
      <span className={isNegative ? 'text-red-600' : ''}>
        {formatted}
        {typeof anexoCount === 'number' && anexoCount > 0 && (
          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 font-normal">
            <Layers className="h-2.5 w-2.5 mr-0.5" />
            {anexoCount}
          </Badge>
        )}
      </span>
    );
  };

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header fijo */}
      <div className="flex-shrink-0 space-y-3 pb-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Polizas</h1>
            <p className="text-sm text-muted-foreground">{tenantName}</p>
          </div>
          <Link href="/polizas/nueva">
            <Button data-testid="new-policy-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Poliza
            </Button>
          </Link>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'activa', label: 'Activas', count: statusCounts.activa },
            { key: 'no_renovada', label: 'No renovadas', count: statusCounts.no_renovada },
            { key: 'inactiva', label: 'Inactivas', count: statusCounts.inactiva },
            { key: 'cancelada', label: 'Revocadas', count: statusCounts.cancelada },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-slate-200 text-slate-800 ring-1 ring-slate-400'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search + Excel */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por numero o aseguradora..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-policies-input"
            />
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting}
              data-testid="export-excel-btn"
              className="text-xs gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {isExporting ? 'Exportando...' : 'Excel'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabla scrolleable - Compacta */}
      <div className="flex-1 overflow-auto">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingScreen />
              </div>
            ) : policies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No se encontraron polizas</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="py-2 px-3">Numero</TableHead>
                    <TableHead className="py-2 px-3">Cliente</TableHead>
                    <TableHead className="py-2 px-3">Aseguradora</TableHead>
                    <TableHead className="py-2 px-3">Ramo</TableHead>
                    <TableHead className="py-2 px-3 text-right">Prima Consolidada</TableHead>
                    <TableHead className="py-2 px-3">Estado</TableHead>
                    <TableHead className="py-2 px-3">Vencimiento</TableHead>
                    <TableHead className="py-2 px-3 text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id} className="text-xs">
                      <TableCell className="py-1.5 px-3 font-medium">{policy.policy_number}</TableCell>
                      <TableCell className="py-1.5 px-3">{policy.client_name || 'N/A'}</TableCell>
                      <TableCell className="py-1.5 px-3">{policy.insurer}</TableCell>
                      <TableCell className="py-1.5 px-3">
                        {policy.insurance_line?.name || POLICY_LINE_LABELS[policy.line as PolicyLine] || policy.line || '-'}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-right">
                        {formatPremiumDisplay(policy.consolidated_premium || policy.premium, policy.anexo_count)}
                      </TableCell>
                      <TableCell className="py-1.5 px-3">
                        <Badge className={`text-[10px] ${POLICY_STATUS_COLORS[policy.status as PolicyStatus]}`}>
                          {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 px-3">{formatDate(policy.end_date)}</TableCell>
                      <TableCell className="py-1.5 px-3 text-center">
                        <Link href={`/polizas/${policy.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`view-policy-${policy.id}`}>
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Pagina {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
