'use client';

// =====================================================
// COMPONENTE: CommissionsPanel
// Panel de comisiones con filtros y exportación
// =====================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type CommissionWithRelations,
  type CommissionsSummary,
  type CommissionStatus,
  COMMISSION_STATUS_LABELS,
  COMMISSION_STATUS_COLORS,
  LINE_LABELS,
  formatCurrency,
  formatPeriod,
  formatDateTime
} from '@/lib/validations/billing';
import {
  Wallet,
  Download,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface CommissionsPanelProps {
  summary: CommissionsSummary | null;
  onUpdate?: () => void;
}

interface Agent {
  id: string;
  full_name: string;
}

export function CommissionsPanel({ summary, onUpdate }: CommissionsPanelProps) {
  const { tenantId } = useTenant();
  
  const [commissions, setCommissions] = useState<CommissionWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros - Inicializar con el primer día del mes actual
  const getInitialPeriod = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getInitialPeriod());
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agents, setAgents] = useState<Agent[]>([]);
  
  // Modal de marcar cobrada
  const [selectedCommission, setSelectedCommission] = useState<CommissionWithRelations | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectDate, setCollectDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar agentes
  const loadAgents = useCallback(async () => {
    if (!tenantId) return;
    
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['agent', 'senior_agent', 'admin'])
      .order('full_name');
    
    if (data) {
      setAgents(data);
    }
  }, [tenantId]);

  // Cargar comisiones
  const loadCommissions = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      // Intentar usar RPC primero
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_commissions_by_period', {
          p_tenant_id: tenantId,
          p_period_month: selectedPeriod,
          p_agent_id: selectedAgent !== 'all' ? selectedAgent : null
        });
        
        if (!rpcError && rpcData) {
          let filtered = rpcData as CommissionWithRelations[];
          if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(c => c.status === statusFilter);
          }
          setCommissions(filtered);
          setTotal(filtered.length);
          setIsLoading(false);
          return;
        }
      } catch {
        // RPC no disponible, usar fallback
      }
      
      // Fallback: query directa
      let query = supabase
        .from('commissions')
        .select(`
          *,
          policies!inner(id, policy_number, insurer, line, premium, client_id),
          users(id, full_name)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('period_month', selectedPeriod)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      if (selectedAgent !== 'all') {
        query = query.eq('agent_id', selectedAgent);
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, count, error } = await query;
      
      if (error) {
        console.error('Error loading commissions:', error);
      } else if (data) {
        // Necesitamos obtener el nombre del cliente
        const policyIds = data.map((c: Record<string, unknown>) => 
          (c.policies as { client_id: string })?.client_id
        ).filter(Boolean);
        
        let clientsMap: Record<string, string> = {};
        if (policyIds.length > 0) {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, full_name')
            .in('id', policyIds);
          
          if (clients) {
            clientsMap = clients.reduce((acc: Record<string, string>, c: { id: string; full_name: string }) => {
              acc[c.id] = c.full_name;
              return acc;
            }, {});
          }
        }
        
        const mapped = data.map((c: Record<string, unknown>) => {
          const policy = c.policies as { id: string; policy_number: string; insurer: string; line: string; premium: number; client_id: string };
          const agent = c.users as { id: string; full_name: string } | null;
          return {
            id: c.id as string,
            policy_id: c.policy_id as string,
            policy_number: policy?.policy_number || '',
            client_name: clientsMap[policy?.client_id] || 'N/A',
            insurer: policy?.insurer || '',
            line: policy?.line || '',
            agent_id: c.agent_id as string | null,
            agent_name: agent?.full_name || null,
            amount: c.amount as number,
            rate_pct: c.rate_pct as number,
            status: c.status as CommissionStatus,
            period_month: c.period_month as string,
            paid_at: c.paid_at as string | null,
            premium: policy?.premium || 0
          };
        }) as CommissionWithRelations[];
        
        setCommissions(mapped);
        setTotal(count || 0);
      }
    } catch (error) {
      console.error('Error loading commissions:', error);
    }
    setIsLoading(false);
  }, [tenantId, selectedPeriod, selectedAgent, statusFilter, page, pageSize]);

  useEffect(() => {
    if (tenantId) {
      loadAgents();
    }
  }, [tenantId, loadAgents]);

  useEffect(() => {
    if (tenantId) {
      loadCommissions();
    }
  }, [tenantId, loadCommissions]);

  // Navegación de período
  const handlePrevPeriod = () => {
    const current = new Date(selectedPeriod);
    const prevMonth = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const newPeriod = prevMonth.toISOString().split('T')[0];
    console.log('Prev period:', selectedPeriod, '->', newPeriod);
    setSelectedPeriod(newPeriod);
  };

  const handleNextPeriod = () => {
    const current = new Date(selectedPeriod);
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const today = new Date();
    
    // Solo permitir avanzar si el próximo mes no es futuro
    if (nextMonth <= today) {
      const newPeriod = nextMonth.toISOString().split('T')[0];
      console.log('Next period:', selectedPeriod, '->', newPeriod);
      setSelectedPeriod(newPeriod);
    }
  };

  // Verificar si el botón siguiente debe estar deshabilitado
  const isNextDisabled = () => {
    const current = new Date(selectedPeriod);
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    return nextMonth > new Date();
  };

  // Marcar como cobrada
  const handleMarkCollected = async () => {
    if (!selectedCommission || !tenantId) return;
    
    setIsSubmitting(true);
    try {
      const supabase = getBrowserClient();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('commissions')
        .update({
          status: 'collected',
          paid_at: new Date(collectDate).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCommission.id)
        .eq('tenant_id', tenantId);
      
      if (error) {
        console.error('Error marking commission collected:', error);
      } else {
        setShowCollectModal(false);
        setSelectedCommission(null);
        loadCommissions();
        onUpdate?.();
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setIsSubmitting(false);
  };

  // Exportar a Excel
  const handleExportExcel = () => {
    if (commissions.length === 0) return;
    
    const exportData = commissions.map(c => ({
      'Período': formatPeriod(c.period_month),
      'Póliza': c.policy_number,
      'Cliente': c.client_name,
      'Aseguradora': c.insurer,
      'Ramo': LINE_LABELS[c.line] || c.line,
      'Agente': c.agent_name || 'Sin asignar',
      'Prima': c.premium,
      '% Comisión': c.rate_pct,
      'Comisión': c.amount,
      'Estado': COMMISSION_STATUS_LABELS[c.status],
      'Fecha Cobro': c.paid_at ? formatDateTime(c.paid_at) : '-'
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Comisiones');
    
    // Formatear fecha para nombre del archivo
    const periodDate = new Date(selectedPeriod);
    const year = periodDate.getFullYear();
    const month = String(periodDate.getMonth() + 1).padStart(2, '0');
    XLSX.writeFile(wb, `Liquidacion_${year}-${month}.xlsx`);
  };

  // Totales del período
  const periodTotals = useMemo(() => {
    return {
      total: commissions.reduce((sum, c) => sum + c.amount, 0),
      pending: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0),
      collected: commissions.filter(c => c.status === 'collected').reduce((sum, c) => sum + c.amount, 0)
    };
  }, [commissions]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Resumen General */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-yellow-50">
            <CardContent className="pt-4">
              <p className="text-sm text-yellow-600">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-700">
                {formatCurrency(summary.total_pending)}
              </p>
              <p className="text-xs text-yellow-600">{summary.count_pending} comisiones</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="pt-4">
              <p className="text-sm text-green-600">Cobradas</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(summary.total_collected)}
              </p>
              <p className="text-xs text-green-600">{summary.count_collected} comisiones</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <p className="text-sm text-gray-600">Anuladas</p>
              <p className="text-2xl font-bold text-gray-700">
                {formatCurrency(summary.total_void)}
              </p>
              <p className="text-xs text-gray-600">{summary.count_void} comisiones</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handlePrevPeriod}
                data-testid="prev-month-btn"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-md">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatPeriod(selectedPeriod)}</span>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNextPeriod}
                disabled={isNextDisabled()}
                data-testid="next-month-btn"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[180px]" data-testid="agent-filter">
                  <SelectValue placeholder="Agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los agentes</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="status-filter">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(COMMISSION_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={loadCommissions} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              
              <Button onClick={handleExportExcel} disabled={commissions.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar XLSX
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen del período */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total del Período</p>
            <p className="text-xl font-bold">{formatCurrency(periodTotals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-yellow-600">Pendiente del Período</p>
            <p className="text-xl font-bold text-yellow-700">{formatCurrency(periodTotals.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-green-600">Cobrado del Período</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(periodTotals.collected)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Comisiones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Wallet className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay comisiones en este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ramo</TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead className="text-right">Prima</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => (
                    <TableRow key={commission.id} data-testid={`commission-row-${commission.id}`}>
                      <TableCell>
                        <Link 
                          href={`/polizas/${commission.policy_id}`}
                          className="hover:underline font-medium"
                        >
                          {commission.policy_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">{commission.insurer}</p>
                      </TableCell>
                      <TableCell>{commission.client_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {LINE_LABELS[commission.line] || commission.line}
                        </Badge>
                      </TableCell>
                      <TableCell>{commission.agent_name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(commission.premium)}
                      </TableCell>
                      <TableCell className="text-center">{commission.rate_pct}%</TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        {formatCurrency(commission.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={COMMISSION_STATUS_COLORS[commission.status]}>
                          {COMMISSION_STATUS_LABELS[commission.status]}
                        </Badge>
                        {commission.paid_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(commission.paid_at)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {commission.status === 'pending' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedCommission(commission);
                              setShowCollectModal(true);
                            }}
                            data-testid={`collect-commission-${commission.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Cobrar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
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

      {/* Modal de Marcar Cobrada */}
      <Dialog open={showCollectModal} onOpenChange={setShowCollectModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Marcar como Cobrada
            </DialogTitle>
            <DialogDescription>
              Confirma la fecha de cobro de esta comisión.
            </DialogDescription>
          </DialogHeader>

          {selectedCommission && (
            <div className="space-y-4 py-4">
              <Card className="bg-slate-50">
                <CardContent className="pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Póliza:</span>
                    <span className="font-medium">{selectedCommission.policy_number}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-muted-foreground">Monto:</span>
                    <span className="font-bold text-green-700">
                      {formatCurrency(selectedCommission.amount)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="collect_date">Fecha de Cobro</Label>
                <Input
                  id="collect_date"
                  type="date"
                  value={collectDate}
                  onChange={(e) => setCollectDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  data-testid="collect-date-input"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCollectModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleMarkCollected} 
              disabled={isSubmitting}
              data-testid="confirm-collect-btn"
            >
              {isSubmitting ? 'Guardando...' : 'Confirmar Cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CommissionsPanel;
