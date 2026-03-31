'use client';

// =====================================================
// PAGINA: Cartera
// /cartera
// Control de cobros, pagos y recaudos
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { formatPremium, formatDate, POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  Search,
  Eye,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  CreditCard,
  FileText,
  Settings2,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface CarteraWithPolicy {
  id: string;
  policy_id: string;
  remision_id: string;
  metodo_pago: 'contado' | 'financiado' | 'acuerdo_pago';
  estado: 'pendiente' | 'abono' | 'pagada';
  valor_prima: number;
  valor_iva: number;
  valor_gastos: number;
  valor_total: number;
  total_pagado: number;
  saldo_pendiente: number;
  financiera: string | null;
  valor_cuota_financiada: number | null;
  fecha_ingreso: string;
  fecha_ultimo_pago: string | null;
  remision: {
    numero_remision: string;
  } | null;
  policy: {
    id: string;
    policy_number: string;
    anexo: string | null;
    insurer: string;
    line: string;
    start_date: string;
    end_date: string;
    clients: { full_name: string } | null;
    insurance_line: { name: string } | null;
  } | null;
}

interface PagoRegistro {
  id: string;
  fecha_pago: string;
  monto_prima: number;
  monto_iva: number;
  monto_total: number;
  notas: string | null;
  created_at: string;
}

interface CuotaAcuerdo {
  id: string;
  numero_cuota: number;
  valor_cuota: number;
  fecha_vencimiento: string;
  estado: 'pendiente' | 'pagada';
  fecha_pago: string | null;
}

const METODO_PAGO_LABELS: Record<string, string> = {
  contado: 'Contado',
  financiado: 'Financiado',
  acuerdo_pago: 'Acuerdo de Pago',
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  abono: 'Abono parcial',
  pagada: 'Pagada',
};

const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-300',
  abono: 'bg-blue-50 text-blue-700 border-blue-300',
  pagada: 'bg-green-50 text-green-700 border-green-300',
};

export default function CarteraPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();

  const [activeTab, setActiveTab] = useState<'pendiente' | 'abono' | 'pagada' | 'all'>('all');
  const [cartera, setCartera] = useState<CarteraWithPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Resumen
  const [resumen, setResumen] = useState({ totalCartera: 0, totalRecaudado: 0, totalPendiente: 0, countPendiente: 0, countAbono: 0, countPagada: 0 });

  // Dialog pago
  const [showPagoDialog, setShowPagoDialog] = useState(false);
  const [selectedCartera, setSelectedCartera] = useState<CarteraWithPolicy | null>(null);
  const [pagoForm, setPagoForm] = useState({ fecha_pago: new Date().toISOString().split('T')[0], monto_prima: '', monto_iva: '', monto_total: '', notas: '' });
  const [isSubmittingPago, setIsSubmittingPago] = useState(false);

  // Dialog metodo pago
  const [showMetodoDialog, setShowMetodoDialog] = useState(false);
  const [selectedForMetodo, setSelectedForMetodo] = useState<CarteraWithPolicy | null>(null);
  const [metodoForm, setMetodoForm] = useState({ metodo_pago: 'contado', financiera: '', valor_cuota_financiada: '', num_cuotas: '3', cuotas: [] as { valor: string; fecha: string }[] });
  const [isSubmittingMetodo, setIsSubmittingMetodo] = useState(false);

  // Dialog historial
  const [showHistorialDialog, setShowHistorialDialog] = useState(false);
  const [historialCartera, setHistorialCartera] = useState<CarteraWithPolicy | null>(null);
  const [historialPagos, setHistorialPagos] = useState<PagoRegistro[]>([]);
  const [historialCuotas, setHistorialCuotas] = useState<CuotaAcuerdo[]>([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);

  const loadCartera = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      let query = supabase
        .from('cartera')
        .select(`
          *,
          remision:remisiones(numero_remision),
          policy:policies!inner(
            id, policy_number, anexo, insurer, line, start_date, end_date,
            clients(full_name),
            insurance_line:insurance_lines(name)
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('fecha_ingreso', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (activeTab !== 'all') {
        query = query.eq('estado', activeTab);
      }

      const { data, count, error } = await query;

      if (error) {
        console.error('Error loading cartera:', error);
        setIsLoading(false);
        return;
      }

      let filtered = (data || []) as CarteraWithPolicy[];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c =>
          c.policy?.policy_number?.toLowerCase().includes(q) ||
          c.policy?.clients?.full_name?.toLowerCase().includes(q) ||
          c.remision?.numero_remision?.toLowerCase().includes(q)
        );
      }

      setCartera(filtered);
      setTotal(searchQuery ? filtered.length : (count || 0));
    } catch (error) {
      console.error('Error:', error);
    }
    setIsLoading(false);
  }, [tenantId, activeTab, page, pageSize, searchQuery]);

  const loadResumen = useCallback(async () => {
    if (!tenantId) return;
    try {
      const supabase = getBrowserClient();
      const { data } = await supabase
        .from('cartera')
        .select('estado, valor_total, total_pagado, saldo_pendiente')
        .eq('tenant_id', tenantId);

      if (data) {
        let totalCartera = 0, totalRecaudado = 0, totalPendiente = 0;
        let countPendiente = 0, countAbono = 0, countPagada = 0;

        data.forEach((c: { estado: string; valor_total: number; total_pagado: number; saldo_pendiente: number }) => {
          totalCartera += c.valor_total || 0;
          totalRecaudado += c.total_pagado || 0;
          totalPendiente += c.saldo_pendiente || 0;
          if (c.estado === 'pendiente') countPendiente++;
          else if (c.estado === 'abono') countAbono++;
          else if (c.estado === 'pagada') countPagada++;
        });

        setResumen({ totalCartera, totalRecaudado, totalPendiente, countPendiente, countAbono, countPagada });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadCartera();
      loadResumen();
    }
  }, [isLoadingTenant, tenantId, loadCartera, loadResumen]);

  // --- Metodo de pago ---
  const handleOpenMetodo = (item: CarteraWithPolicy) => {
    setSelectedForMetodo(item);
    setMetodoForm({
      metodo_pago: item.metodo_pago,
      financiera: item.financiera || '',
      valor_cuota_financiada: item.valor_cuota_financiada?.toString() || '',
      num_cuotas: '3',
      cuotas: [],
    });
    setShowMetodoDialog(true);
  };

  const generateCuotas = (numCuotas: number) => {
    if (!selectedForMetodo) return;
    const valorCuota = Math.ceil(selectedForMetodo.saldo_pendiente / numCuotas);
    const cuotas = [];
    for (let i = 0; i < numCuotas; i++) {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() + i + 1);
      cuotas.push({
        valor: i === numCuotas - 1
          ? (selectedForMetodo.saldo_pendiente - valorCuota * (numCuotas - 1)).toString()
          : valorCuota.toString(),
        fecha: fecha.toISOString().split('T')[0],
      });
    }
    setMetodoForm(prev => ({ ...prev, num_cuotas: numCuotas.toString(), cuotas }));
  };

  const handleSaveMetodo = async () => {
    if (!selectedForMetodo) return;
    setIsSubmittingMetodo(true);
    try {
      const supabase = getBrowserClient();

      const updateData: Record<string, unknown> = {
        metodo_pago: metodoForm.metodo_pago,
        updated_at: new Date().toISOString(),
      };

      if (metodoForm.metodo_pago === 'financiado') {
        updateData.financiera = metodoForm.financiera;
        updateData.valor_cuota_financiada = parseFloat(metodoForm.valor_cuota_financiada) || 0;
      } else {
        updateData.financiera = null;
        updateData.valor_cuota_financiada = null;
      }

      const { error } = await (supabase as any)
        .from('cartera')
        .update(updateData)
        .eq('id', selectedForMetodo.id);

      if (error) {
        toast.error('Error al actualizar: ' + error.message);
        setIsSubmittingMetodo(false);
        return;
      }

      // Si es acuerdo de pago, crear cuotas
      if (metodoForm.metodo_pago === 'acuerdo_pago' && metodoForm.cuotas.length > 0) {
        // Eliminar cuotas anteriores
        await (supabase as any)
          .from('cuotas_acuerdo')
          .delete()
          .eq('cartera_id', selectedForMetodo.id);

        const cuotasInsert = metodoForm.cuotas.map((c, i) => ({
          tenant_id: tenantId,
          cartera_id: selectedForMetodo.id,
          numero_cuota: i + 1,
          valor_cuota: parseFloat(c.valor) || 0,
          fecha_vencimiento: c.fecha,
          estado: 'pendiente',
        }));

        const { error: cuotasError } = await (supabase as any)
          .from('cuotas_acuerdo')
          .insert(cuotasInsert);

        if (cuotasError) {
          toast.error('Error al crear cuotas: ' + cuotasError.message);
        }
      }

      toast.success('Metodo de pago actualizado');
      setShowMetodoDialog(false);
      loadCartera();
    } catch {
      toast.error('Error inesperado');
    }
    setIsSubmittingMetodo(false);
  };

  // --- Registrar pago ---
  const handleOpenPago = (item: CarteraWithPolicy) => {
    setSelectedCartera(item);
    setPagoForm({
      fecha_pago: new Date().toISOString().split('T')[0],
      monto_prima: '',
      monto_iva: '',
      monto_total: '',
      notas: '',
    });
    setShowPagoDialog(true);
  };

  const handlePagoFormChange = (field: string, value: string) => {
    setPagoForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'monto_prima' || field === 'monto_iva') {
        const prima = parseFloat(updated.monto_prima) || 0;
        const iva = parseFloat(updated.monto_iva) || 0;
        updated.monto_total = (prima + iva).toString();
      }
      return updated;
    });
  };

  const handleSubmitPago = async () => {
    if (!selectedCartera) return;

    const montoTotal = parseFloat(pagoForm.monto_total) || 0;
    if (montoTotal <= 0) {
      toast.error('El monto total debe ser mayor a 0');
      return;
    }

    setIsSubmittingPago(true);
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await (supabase.rpc as any)('registrar_pago', {
        p_cartera_id: selectedCartera.id,
        p_fecha_pago: pagoForm.fecha_pago,
        p_monto_prima: parseFloat(pagoForm.monto_prima) || 0,
        p_monto_iva: parseFloat(pagoForm.monto_iva) || 0,
        p_monto_total: montoTotal,
        p_notas: pagoForm.notas || null,
        p_user_id: user?.id || null,
      });

      if (error) {
        toast.error('Error al registrar pago: ' + error.message);
        setIsSubmittingPago(false);
        return;
      }

      const result = data as { success: boolean; estado?: string; saldo_pendiente?: number; error?: string };

      if (result && result.success) {
        toast.success(
          result.estado === 'pagada'
            ? 'Pago total registrado - Poliza pagada'
            : `Abono registrado - Saldo: ${formatPremium(result.saldo_pendiente || 0)}`
        );
        setShowPagoDialog(false);
        loadCartera();
        loadResumen();
      } else {
        toast.error(result?.error || 'Error al registrar pago');
      }
    } catch {
      toast.error('Error inesperado');
    }
    setIsSubmittingPago(false);
  };

  // --- Historial ---
  const handleOpenHistorial = async (item: CarteraWithPolicy) => {
    setHistorialCartera(item);
    setShowHistorialDialog(true);
    setIsLoadingHistorial(true);

    try {
      const supabase = getBrowserClient();

      const [pagosRes, cuotasRes] = await Promise.all([
        (supabase as any)
          .from('pagos')
          .select('*')
          .eq('cartera_id', item.id)
          .order('fecha_pago', { ascending: false }),
        (supabase as any)
          .from('cuotas_acuerdo')
          .select('*')
          .eq('cartera_id', item.id)
          .order('numero_cuota', { ascending: true }),
      ]);

      setHistorialPagos((pagosRes.data || []) as PagoRegistro[]);
      setHistorialCuotas((cuotasRes.data || []) as CuotaAcuerdo[]);
    } catch {
      toast.error('Error al cargar historial');
    }
    setIsLoadingHistorial(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="cartera-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cartera</h1>
        <p className="text-sm text-muted-foreground">{tenantName}</p>
      </div>

      {/* Resumen Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cartera Total</p>
                <p className="text-2xl font-bold text-slate-900">{formatPremium(resumen.totalCartera)}</p>
              </div>
              <Wallet className="w-9 h-9 text-slate-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recaudado</p>
                <p className="text-2xl font-bold text-green-600">{formatPremium(resumen.totalRecaudado)}</p>
              </div>
              <CheckCircle className="w-9 h-9 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendiente por Cobrar</p>
                <p className="text-2xl font-bold text-amber-600">{formatPremium(resumen.totalPendiente)}</p>
              </div>
              <Clock className="w-9 h-9 text-amber-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de estado */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Todas', count: resumen.countPendiente + resumen.countAbono + resumen.countPagada },
          { key: 'pendiente', label: 'Pendientes', count: resumen.countPendiente },
          { key: 'abono', label: 'Con abono', count: resumen.countAbono },
          { key: 'pagada', label: 'Pagadas', count: resumen.countPagada },
        ].map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveTab(tab.key as typeof activeTab); setPage(1); }}
            data-testid={`tab-cartera-${tab.key}`}
          >
            {tab.label} ({tab.count})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por poliza, cliente o remision..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          className="pl-10"
          data-testid="search-cartera-input"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : cartera.length === 0 ? (
            <div className="text-center text-muted-foreground p-12">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron registros en cartera</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Remision</TableHead>
                  <TableHead>Poliza</TableHead>
                  <TableHead>Anexo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartera.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs bg-slate-50">
                        {item.remision?.numero_remision || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.policy?.policy_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.policy?.anexo || '00'}</Badge>
                    </TableCell>
                    <TableCell>{item.policy?.clients?.full_name || 'N/A'}</TableCell>
                    <TableCell>
                      <span className="text-sm">{METODO_PAGO_LABELS[item.metodo_pago]}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatPremium(item.valor_total)}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{formatPremium(item.total_pagado)}</TableCell>
                    <TableCell className="text-right font-medium text-amber-600">{formatPremium(item.saldo_pendiente)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ESTADO_COLORS[item.estado]}>
                        {ESTADO_LABELS[item.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/polizas/${item.policy_id}`}>
                          <Button variant="ghost" size="sm" title="Ver poliza">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" title="Metodo de pago" onClick={() => handleOpenMetodo(item)}>
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Historial" onClick={() => handleOpenHistorial(item)}>
                          <FileText className="w-4 h-4" />
                        </Button>
                        {item.estado !== 'pagada' && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPago(item)}
                            className="bg-green-600 hover:bg-green-700"
                            data-testid={`registrar-pago-${item.id}`}
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
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

      {/* Dialog: Metodo de Pago */}
      <Dialog open={showMetodoDialog} onOpenChange={setShowMetodoDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Metodo de Pago</DialogTitle>
            <DialogDescription>
              Poliza {selectedForMetodo?.policy?.policy_number} - Saldo: {formatPremium(selectedForMetodo?.saldo_pendiente || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Metodo de pago</Label>
              <Select value={metodoForm.metodo_pago} onValueChange={(v) => setMetodoForm(prev => ({ ...prev, metodo_pago: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado">Contado (abonos parciales o total)</SelectItem>
                  <SelectItem value="financiado">Financiado</SelectItem>
                  <SelectItem value="acuerdo_pago">Acuerdo de Pago (cuotas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {metodoForm.metodo_pago === 'financiado' && (
              <>
                <div className="space-y-2">
                  <Label>Financiera</Label>
                  <Input
                    placeholder="Nombre de la financiera"
                    value={metodoForm.financiera}
                    onChange={(e) => setMetodoForm(prev => ({ ...prev, financiera: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor de la cuota</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={metodoForm.valor_cuota_financiada}
                    onChange={(e) => setMetodoForm(prev => ({ ...prev, valor_cuota_financiada: e.target.value }))}
                  />
                </div>
              </>
            )}

            {metodoForm.metodo_pago === 'acuerdo_pago' && (
              <>
                <div className="space-y-2">
                  <Label>Numero de cuotas</Label>
                  <Select value={metodoForm.num_cuotas} onValueChange={(v) => generateCuotas(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} cuotas</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {metodoForm.cuotas.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {metodoForm.cuotas.map((cuota, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg">
                        <span className="text-sm font-medium text-muted-foreground w-16">Cuota {i + 1}</span>
                        <Input
                          type="number"
                          value={cuota.valor}
                          onChange={(e) => {
                            const updated = [...metodoForm.cuotas];
                            updated[i].valor = e.target.value;
                            setMetodoForm(prev => ({ ...prev, cuotas: updated }));
                          }}
                          className="flex-1"
                          placeholder="Valor"
                        />
                        <Input
                          type="date"
                          value={cuota.fecha}
                          onChange={(e) => {
                            const updated = [...metodoForm.cuotas];
                            updated[i].fecha = e.target.value;
                            setMetodoForm(prev => ({ ...prev, cuotas: updated }));
                          }}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMetodoDialog(false)} disabled={isSubmittingMetodo}>Cancelar</Button>
            <Button onClick={handleSaveMetodo} disabled={isSubmittingMetodo}>
              {isSubmittingMetodo ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Pago */}
      <Dialog open={showPagoDialog} onOpenChange={setShowPagoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Poliza {selectedCartera?.policy?.policy_number} - Saldo pendiente: {formatPremium(selectedCartera?.saldo_pendiente || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total poliza:</span>
                <span className="font-medium">{formatPremium(selectedCartera?.valor_total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total pagado:</span>
                <span className="font-medium text-green-600">{formatPremium(selectedCartera?.total_pagado || 0)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Saldo pendiente:</span>
                <span className="text-amber-600">{formatPremium(selectedCartera?.saldo_pendiente || 0)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={pagoForm.fecha_pago}
                onChange={(e) => handlePagoFormChange('fecha_pago', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prima</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={pagoForm.monto_prima}
                  onChange={(e) => handlePagoFormChange('monto_prima', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>IVA</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={pagoForm.monto_iva}
                  onChange={(e) => handlePagoFormChange('monto_iva', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total a pagar</Label>
              <Input
                type="number"
                value={pagoForm.monto_total}
                onChange={(e) => handlePagoFormChange('monto_total', e.target.value)}
                className="font-semibold text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Referencia de pago, observaciones..."
                value={pagoForm.notas}
                onChange={(e) => setPagoForm(prev => ({ ...prev, notas: e.target.value }))}
                rows={2}
              />
            </div>

            {selectedCartera && parseFloat(pagoForm.monto_total) > 0 && parseFloat(pagoForm.monto_total) < selectedCartera.saldo_pendiente && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                Este pago se registrara como <strong>abono parcial</strong>. Saldo restante: {formatPremium(selectedCartera.saldo_pendiente - (parseFloat(pagoForm.monto_total) || 0))}
              </div>
            )}
            {selectedCartera && parseFloat(pagoForm.monto_total) >= selectedCartera.saldo_pendiente && parseFloat(pagoForm.monto_total) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                Este pago cubrira el <strong>saldo total</strong>. La poliza quedara como pagada.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagoDialog(false)} disabled={isSubmittingPago}>Cancelar</Button>
            <Button onClick={handleSubmitPago} disabled={isSubmittingPago} className="bg-green-600 hover:bg-green-700">
              {isSubmittingPago ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><DollarSign className="w-4 h-4 mr-2" />Registrar Pago</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Historial */}
      <Dialog open={showHistorialDialog} onOpenChange={setShowHistorialDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Pagos</DialogTitle>
            <DialogDescription>
              Poliza {historialCartera?.policy?.policy_number} - {METODO_PAGO_LABELS[historialCartera?.metodo_pago || 'contado']}
            </DialogDescription>
          </DialogHeader>

          {isLoadingHistorial ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor total:</span>
                  <span className="font-medium">{formatPremium(historialCartera?.valor_total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total pagado:</span>
                  <span className="font-medium text-green-600">{formatPremium(historialCartera?.total_pagado || 0)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Saldo:</span>
                  <span className={historialCartera?.saldo_pendiente === 0 ? 'text-green-600' : 'text-amber-600'}>
                    {formatPremium(historialCartera?.saldo_pendiente || 0)}
                  </span>
                </div>
              </div>

              {/* Cuotas (si aplica) */}
              {historialCuotas.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Cuotas del Acuerdo</h4>
                  <div className="space-y-2">
                    {historialCuotas.map(cuota => (
                      <div key={cuota.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg text-sm">
                        <span className="font-medium">Cuota {cuota.numero_cuota}</span>
                        <span>{formatPremium(cuota.valor_cuota)}</span>
                        <span className="text-muted-foreground">{formatDate(cuota.fecha_vencimiento)}</span>
                        <Badge variant="outline" className={cuota.estado === 'pagada' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                          {cuota.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pagos */}
              <div>
                <h4 className="font-medium text-sm mb-2">Pagos Registrados ({historialPagos.length})</h4>
                {historialPagos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay pagos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {historialPagos.map(pago => (
                      <div key={pago.id} className="bg-green-50 p-3 rounded-lg text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">{formatDate(pago.fecha_pago)}</span>
                          <span className="font-bold text-green-700">{formatPremium(pago.monto_total)}</span>
                        </div>
                        {(pago.monto_prima > 0 || pago.monto_iva > 0) && (
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Prima: {formatPremium(pago.monto_prima)}</span>
                            <span>IVA: {formatPremium(pago.monto_iva)}</span>
                          </div>
                        )}
                        {pago.notas && <p className="text-xs text-muted-foreground">{pago.notas}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
