'use client';

// =====================================================
// PAGINA: Control de Comisiones
// /comisiones
// Gestión de comisiones generadas automáticamente
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatPremium, formatDate } from '@/lib/validations/policies';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  Search, Eye, Loader2, ChevronLeft, ChevronRight, Coins, CheckCircle2, Handshake
} from 'lucide-react';
import { toast } from 'sonner';

interface ComisionWithDetails {
  id: string;
  tenant_id: string;
  policy_id: string;
  cartera_id: string;
  monto_prima_base: number;
  monto_prima_pagada: number;
  comision_agencia_pct: number;
  valor_comision_total: number;
  allied_agent_id: string | null;
  allied_agent_pct: number;
  valor_comision_aliado: number;
  valor_comision_agencia: number;
  estado: 'sin_recaudo' | 'liquidada' | 'pagada_aliado';
  fecha_liquidacion: string | null;
  fecha_pago_aliado: string | null;
  notas_pago_aliado: string | null;
  created_at: string;
  policy: {
    id: string;
    policy_number: string;
    anexo: string | null;
    insurer: string;
    clients: { full_name: string } | null;
    insurance_line: { name: string } | null;
  } | null;
  allied_agent: { id: string; full_name: string } | null;
  cartera: { estado: string; total_pagado: number; valor_total: number } | null;
}

const ESTADO_LABELS: Record<string, string> = {
  sin_recaudo: 'Sin Recaudo',
  liquidada: 'Liquidada',
  pagada_aliado: 'Pagada a Aliado',
};

const ESTADO_COLORS: Record<string, string> = {
  sin_recaudo: 'bg-slate-100 text-slate-700 border-slate-300',
  liquidada: 'bg-amber-50 text-amber-700 border-amber-300',
  pagada_aliado: 'bg-green-50 text-green-700 border-green-300',
};

export default function ComisionesPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<'all' | 'sin_recaudo' | 'liquidada' | 'pagada_aliado'>('all');
  const [comisiones, setComisiones] = useState<ComisionWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [resumen, setResumen] = useState({
    countSinRecaudo: 0, countLiquidada: 0, countPagada: 0,
    totalComision: 0, totalAliado: 0, totalAgencia: 0, totalPendienteAliado: 0
  });

  // Bulk pay
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPagarDialog, setShowPagarDialog] = useState(false);
  const [pagarNotas, setPagarNotas] = useState('');
  const [isSubmittingPago, setIsSubmittingPago] = useState(false);
  const [pagarMode, setPagarMode] = useState<'single' | 'bulk'>('single');
  const [singleComision, setSingleComision] = useState<ComisionWithDetails | null>(null);

  const loadComisiones = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('comisiones')
        .select(`
          *,
          policy:policies!inner(id, policy_number, anexo, insurer, clients(full_name), insurance_line:insurance_lines(name)),
          allied_agent:allied_agents(id, full_name),
          cartera(estado, total_pagado, valor_total)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (activeTab !== 'all') query = query.eq('estado', activeTab);

      const { data, count, error } = await query;
      if (error) { console.error('Error:', error); setIsLoading(false); return; }

      let filtered = (data || []) as ComisionWithDetails[];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c =>
          c.policy?.policy_number?.toLowerCase().includes(q) ||
          c.policy?.clients?.full_name?.toLowerCase().includes(q) ||
          c.allied_agent?.full_name?.toLowerCase().includes(q) ||
          c.policy?.insurer?.toLowerCase().includes(q)
        );
      }
      setComisiones(filtered);
      setTotal(searchQuery ? filtered.length : (count || 0));
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, [tenantId, activeTab, page, pageSize, searchQuery]);

  const loadResumen = useCallback(async () => {
    if (!tenantId) return;
    try {
      const supabase = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('comisiones')
        .select('estado, valor_comision_total, valor_comision_aliado, valor_comision_agencia')
        .eq('tenant_id', tenantId);

      if (data) {
        let countSinRecaudo = 0, countLiquidada = 0, countPagada = 0;
        let totalComision = 0, totalAliado = 0, totalAgencia = 0, totalPendienteAliado = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.forEach((c: any) => {
          totalComision += c.valor_comision_total || 0;
          totalAliado += c.valor_comision_aliado || 0;
          totalAgencia += c.valor_comision_agencia || 0;
          if (c.estado === 'sin_recaudo') countSinRecaudo++;
          else if (c.estado === 'liquidada') { countLiquidada++; totalPendienteAliado += c.valor_comision_aliado || 0; }
          else if (c.estado === 'pagada_aliado') countPagada++;
        });
        setResumen({ countSinRecaudo, countLiquidada, countPagada, totalComision, totalAliado, totalAgencia, totalPendienteAliado });
      }
    } catch (e) { console.error(e); }
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) { loadComisiones(); loadResumen(); }
  }, [isLoadingTenant, tenantId, loadComisiones, loadResumen]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAllLiquidadas = () => {
    const liquidadas = comisiones.filter(c => c.estado === 'liquidada' && c.allied_agent_id);
    if (selectedIds.size === liquidadas.length && liquidadas.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(liquidadas.map(c => c.id)));
    }
  };

  const handleOpenPagarSingle = (comision: ComisionWithDetails) => {
    setSingleComision(comision);
    setPagarMode('single');
    setPagarNotas('');
    setShowPagarDialog(true);
  };

  const handleOpenPagarBulk = () => {
    if (selectedIds.size === 0) { toast.error('Selecciona al menos una comisión'); return; }
    setPagarMode('bulk');
    setPagarNotas('');
    setShowPagarDialog(true);
  };

  const handleConfirmarPago = async () => {
    setIsSubmittingPago(true);
    try {
      const supabase = getBrowserClient();
      const idsToUpdate = pagarMode === 'single' && singleComision
        ? [singleComision.id]
        : Array.from(selectedIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('comisiones')
        .update({
          estado: 'pagada_aliado',
          fecha_pago_aliado: new Date().toISOString(),
          notas_pago_aliado: pagarNotas || null,
          updated_at: new Date().toISOString()
        })
        .in('id', idsToUpdate)
        .eq('estado', 'liquidada');

      if (error) {
        toast.error('Error al registrar pago: ' + error.message);
      } else {
        toast.success(`${idsToUpdate.length} comisi${idsToUpdate.length === 1 ? 'ón marcada' : 'ones marcadas'} como pagadas al aliado`);
        setShowPagarDialog(false);
        setSelectedIds(new Set());
        setSingleComision(null);
        loadComisiones();
        loadResumen();
      }
    } catch { toast.error('Error inesperado'); }
    setIsSubmittingPago(false);
  };

  // Calcular total seleccionado
  const totalSeleccionado = comisiones
    .filter(c => selectedIds.has(c.id))
    .reduce((sum, c) => sum + (c.valor_comision_aliado || 0), 0);

  const totalPages = Math.ceil(total / pageSize);
  if (isLoadingTenant) return <LoadingScreen />;

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="comisiones-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control Comisiones</h1>
          <p className="text-sm text-muted-foreground">{tenantName}</p>
        </div>
      </div>

      {/* Resumen Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Comisión Total</p>
            <p className="text-lg font-bold text-slate-900">{formatPremium(resumen.totalComision)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Comisión Agencia</p>
            <p className="text-lg font-bold text-emerald-600">{formatPremium(resumen.totalAgencia)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Aliados</p>
            <p className="text-lg font-bold text-blue-600">{formatPremium(resumen.totalAliado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pendiente Aliados</p>
            <p className="text-lg font-bold text-amber-600">{formatPremium(resumen.totalPendienteAliado)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Todas', count: resumen.countSinRecaudo + resumen.countLiquidada + resumen.countPagada, color: 'slate' },
            { key: 'sin_recaudo', label: 'Sin Recaudo', count: resumen.countSinRecaudo, color: 'slate' },
            { key: 'liquidada', label: 'Liquidadas', count: resumen.countLiquidada, color: 'amber' },
            { key: 'pagada_aliado', label: 'Pagadas Aliado', count: resumen.countPagada, color: 'green' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as typeof activeTab); setPage(1); setSelectedIds(new Set()); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? tab.color === 'amber' ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                    : tab.color === 'green' ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
                    : 'bg-slate-200 text-slate-800 ring-1 ring-slate-400'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === tab.key
                  ? tab.color === 'amber' ? 'bg-amber-200 text-amber-900'
                    : tab.color === 'green' ? 'bg-green-200 text-green-900'
                    : 'bg-slate-300 text-slate-800'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar póliza, cliente, aliado..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9 h-8 text-xs"
            data-testid="search-comisiones-input"
          />
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-xs font-medium text-blue-800">
            {selectedIds.size} seleccionada(s) — Total aliado: {formatPremium(totalSeleccionado)}
          </span>
          <Button size="sm" onClick={handleOpenPagarBulk} className="bg-green-600 hover:bg-green-700 h-7 text-xs px-3">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Pagar seleccionadas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs px-2">
            Limpiar
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : comisiones.length === 0 ? (
            <div className="text-center text-muted-foreground p-12">
              <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron comisiones</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  {(activeTab === 'liquidada' || activeTab === 'all') && (
                    <TableHead className="w-8">
                      <Checkbox
                        checked={selectedIds.size > 0 && selectedIds.size === comisiones.filter(c => c.estado === 'liquidada' && c.allied_agent_id).length}
                        onCheckedChange={handleSelectAllLiquidadas}
                        aria-label="Seleccionar todas"
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-xs">Póliza</TableHead>
                  <TableHead className="text-xs">Anexo</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Aseguradora</TableHead>
                  <TableHead className="text-xs text-right">Prima Pagada</TableHead>
                  <TableHead className="text-xs text-right">% Com.</TableHead>
                  <TableHead className="text-xs text-right">Comisión</TableHead>
                  <TableHead className="text-xs">Aliado</TableHead>
                  <TableHead className="text-xs text-right">% Aliado</TableHead>
                  <TableHead className="text-xs text-right">Valor Aliado</TableHead>
                  <TableHead className="text-xs text-right">Valor Agencia</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comisiones.map((com) => (
                  <TableRow key={com.id} className="text-xs">
                    {(activeTab === 'liquidada' || activeTab === 'all') && (
                      <TableCell className="py-2">
                        {com.estado === 'liquidada' && com.allied_agent_id && (
                          <Checkbox
                            checked={selectedIds.has(com.id)}
                            onCheckedChange={() => handleToggleSelect(com.id)}
                            aria-label={`Seleccionar ${com.policy?.policy_number}`}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="py-2 font-medium text-xs">
                      {com.policy?.policy_number}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-[10px]">{com.policy?.anexo || '00'}</Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs whitespace-nowrap">
                      {com.policy?.clients?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell className="py-2 text-xs">{com.policy?.insurer}</TableCell>
                    <TableCell className="py-2 text-xs text-right">{formatPremium(com.monto_prima_pagada)}</TableCell>
                    <TableCell className="py-2 text-xs text-right">{com.comision_agencia_pct}%</TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium">{formatPremium(com.valor_comision_total)}</TableCell>
                    <TableCell className="py-2 text-xs whitespace-nowrap">
                      {com.allied_agent ? (
                        <span className="inline-flex items-center gap-1">
                          <Handshake className="w-3 h-3 text-blue-500" />
                          {com.allied_agent.full_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right">
                      {com.allied_agent_id ? `${com.allied_agent_pct}%` : '-'}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium text-blue-600">
                      {com.allied_agent_id ? formatPremium(com.valor_comision_aliado) : '-'}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium text-emerald-600">
                      {formatPremium(com.valor_comision_agencia)}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={`text-[10px] ${ESTADO_COLORS[com.estado]}`}>
                        {ESTADO_LABELS[com.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/polizas/${com.policy_id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`ver-poliza-${com.id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        {com.estado === 'liquidada' && com.allied_agent_id && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPagarSingle(com)}
                            className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2"
                            data-testid={`pagar-aliado-${com.id}`}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Pagar
                          </Button>
                        )}
                      </div>
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
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">Pagina {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Pagar a Aliado */}
      <Dialog open={showPagarDialog} onOpenChange={setShowPagarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pago a Aliado</DialogTitle>
            <DialogDescription>
              {pagarMode === 'single' && singleComision ? (
                <>
                  Marcar como pagada la comisión de <strong>{singleComision.allied_agent?.full_name}</strong> por
                  la póliza <strong>{singleComision.policy?.policy_number}</strong>
                  — Valor: <strong>{formatPremium(singleComision.valor_comision_aliado)}</strong>
                </>
              ) : (
                <>
                  Marcar como pagadas <strong>{selectedIds.size}</strong> comisiones
                  — Total: <strong>{formatPremium(totalSeleccionado)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {pagarMode === 'bulk' && (
              <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {comisiones.filter(c => selectedIds.has(c.id)).map(c => (
                  <div key={c.id} className="flex justify-between text-xs">
                    <span>{c.policy?.policy_number} - {c.allied_agent?.full_name}</span>
                    <span className="font-medium">{formatPremium(c.valor_comision_aliado)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas del pago (opcional)</label>
              <Textarea
                placeholder="Referencia de transferencia, fecha de consignación, etc."
                value={pagarNotas}
                onChange={(e) => setPagarNotas(e.target.value)}
                rows={3}
                data-testid="pagar-aliado-notas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagarDialog(false)} disabled={isSubmittingPago}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarPago}
              disabled={isSubmittingPago}
              className="bg-green-600 hover:bg-green-700"
              data-testid="confirm-pagar-aliado"
            >
              {isSubmittingPago ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar Pago</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
