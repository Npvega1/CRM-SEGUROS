'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatPremium, formatDate } from '@/lib/validations/policies';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  Search, Eye, DollarSign, Clock, CheckCircle, Loader2, ChevronLeft, ChevronRight,
  Wallet, FileText, Settings2, Upload, Paperclip, File
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
  remision: { numero_remision: string } | null;
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
  comprobante_url: string | null;
  comprobante_name: string | null;
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

const METODO_LABELS: Record<string, string> = { contado: 'Contado', financiado: 'Financiado', acuerdo_pago: 'Acuerdo' };
const ESTADO_LABELS: Record<string, string> = { pendiente: 'Pendiente', abono: 'Abono', pagada: 'Pagada' };
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
  const [resumen, setResumen] = useState({ totalCartera: 0, totalRecaudado: 0, totalPendiente: 0, countPendiente: 0, countAbono: 0, countPagada: 0 });

  const [showPagoDialog, setShowPagoDialog] = useState(false);
  const [selectedCartera, setSelectedCartera] = useState<CarteraWithPolicy | null>(null);
  const [pagoTotal, setPagoTotal] = useState('');
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [pagoNotas, setPagoNotas] = useState('');
  const [comprobanteFile, setComprobanteFile] = useState<globalThis.File | null>(null);
  const [isSubmittingPago, setIsSubmittingPago] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMetodoDialog, setShowMetodoDialog] = useState(false);
  const [selectedForMetodo, setSelectedForMetodo] = useState<CarteraWithPolicy | null>(null);
  const [metodoForm, setMetodoForm] = useState({ metodo_pago: 'contado', financiera: '', num_cuotas: '3', cuotas: [] as { valor: string; fecha: string }[] });
  const [isSubmittingMetodo, setIsSubmittingMetodo] = useState(false);

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
        .select(`*, remision:remisiones(numero_remision), policy:policies!inner(id, policy_number, anexo, insurer, line, start_date, end_date, clients(full_name), insurance_line:insurance_lines(name))`, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('fecha_ingreso', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (activeTab !== 'all') query = query.eq('estado', activeTab);

      const { data, count, error } = await query;
      if (error) { console.error('Error:', error); setIsLoading(false); return; }

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
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, [tenantId, activeTab, page, pageSize, searchQuery]);

  const loadResumen = useCallback(async () => {
    if (!tenantId) return;
    try {
      const supabase = getBrowserClient();
      const { data } = await supabase.from('cartera').select('estado, valor_total, total_pagado, saldo_pendiente').eq('tenant_id', tenantId);
      if (data) {
        let totalCartera = 0, totalRecaudado = 0, totalPendiente = 0, countPendiente = 0, countAbono = 0, countPagada = 0;
        data.forEach((c: any) => {
          totalCartera += c.valor_total || 0; totalRecaudado += c.total_pagado || 0; totalPendiente += c.saldo_pendiente || 0;
          if (c.estado === 'pendiente') countPendiente++; else if (c.estado === 'abono') countAbono++; else if (c.estado === 'pagada') countPagada++;
        });
        setResumen({ totalCartera, totalRecaudado, totalPendiente, countPendiente, countAbono, countPagada });
      }
    } catch (e) { console.error(e); }
  }, [tenantId]);

  useEffect(() => { if (!isLoadingTenant && tenantId) { loadCartera(); loadResumen(); } }, [isLoadingTenant, tenantId, loadCartera, loadResumen]);

  const handleOpenMetodo = (item: CarteraWithPolicy) => {
    setSelectedForMetodo(item);
    setMetodoForm({ metodo_pago: item.metodo_pago, financiera: item.financiera || '', num_cuotas: '3', cuotas: [] });
    setShowMetodoDialog(true);
  };

  const generateCuotas = (numCuotas: number) => {
    if (!selectedForMetodo) return;
    const valorCuota = Math.ceil(selectedForMetodo.saldo_pendiente / numCuotas);
    const cuotas: { valor: string; fecha: string }[] = [];
    for (let i = 0; i < numCuotas; i++) {
      const fecha = new Date(); fecha.setMonth(fecha.getMonth() + i + 1);
      cuotas.push({
        valor: i === numCuotas - 1 ? (selectedForMetodo.saldo_pendiente - valorCuota * (numCuotas - 1)).toString() : valorCuota.toString(),
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
      const updateData: Record<string, unknown> = { metodo_pago: metodoForm.metodo_pago, updated_at: new Date().toISOString() };
      if (metodoForm.metodo_pago === 'financiado') { updateData.financiera = metodoForm.financiera; updateData.valor_cuota_financiada = null; }
      else { updateData.financiera = null; updateData.valor_cuota_financiada = null; }

      const { error } = await (supabase as any).from('cartera').update(updateData).eq('id', selectedForMetodo.id);
      if (error) { toast.error('Error: ' + error.message); setIsSubmittingMetodo(false); return; }

      if (metodoForm.metodo_pago === 'acuerdo_pago' && metodoForm.cuotas.length > 0) {
        await (supabase as any).from('cuotas_acuerdo').delete().eq('cartera_id', selectedForMetodo.id);
        const cuotasInsert = metodoForm.cuotas.map((c, i) => ({
          tenant_id: tenantId, cartera_id: selectedForMetodo.id, numero_cuota: i + 1,
          valor_cuota: parseFloat(c.valor) || 0, fecha_vencimiento: c.fecha, estado: 'pendiente',
        }));
        const { error: ce } = await (supabase as any).from('cuotas_acuerdo').insert(cuotasInsert);
        if (ce) toast.error('Error cuotas: ' + ce.message);
      }
      toast.success('Metodo de pago actualizado');
      setShowMetodoDialog(false);
      loadCartera();
    } catch { toast.error('Error inesperado'); }
    setIsSubmittingMetodo(false);
  };

  const handleOpenPago = (item: CarteraWithPolicy) => {
    setSelectedCartera(item); setPagoTotal(''); setPagoFecha(new Date().toISOString().split('T')[0]); setPagoNotas(''); setComprobanteFile(null); setShowPagoDialog(true);
  };

  const getRawPago = (): number => parseInt(pagoTotal.replace(/\D/g, '') || '0');
  const calcularDesglose = (v: number) => { const prima = Math.round(v / 1.19); return { prima, iva: v - prima, total: v }; };

  const handleSubmitPago = async () => {
    if (!selectedCartera) return;
    const montoTotal = getRawPago();
    const { prima, iva } = calcularDesglose(montoTotal);
    if (montoTotal <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    setIsSubmittingPago(true);
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Subir comprobante ANTES de registrar pago
      let compUrl: string | null = null;
      let compName: string | null = null;
      if (comprobanteFile) {
        const ts = Date.now();
        const safeName = comprobanteFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${tenantId}/remisiones/${selectedCartera.remision_id}/pagos/${ts}_${safeName}`;
        const { error: upErr } = await supabase.storage.from('policy-documents').upload(path, comprobanteFile, { cacheControl: '3600', upsert: true });
        if (!upErr) { compUrl = path; compName = comprobanteFile.name; }
      }

      const { data, error } = await (supabase.rpc as any)('registrar_pago', {
        p_cartera_id: selectedCartera.id, p_fecha_pago: pagoFecha,
        p_monto_prima: prima, p_monto_iva: iva, p_monto_total: montoTotal,
        p_notas: pagoNotas || null, p_user_id: user?.id || null,
      });

      if (error) { toast.error('Error: ' + error.message); setIsSubmittingPago(false); return; }
      const result = data as { success: boolean; pago_id?: string; estado?: string; saldo_pendiente?: number; error?: string };

      if (result?.success) {
        // Guardar comprobante en el pago
        if (compUrl && result.pago_id) {
          await (supabase as any).from('pagos').update({ comprobante_url: compUrl, comprobante_name: compName }).eq('id', result.pago_id);
        }
        toast.success(result.estado === 'pagada' ? 'Pago total registrado' : `Abono registrado - Saldo: ${formatPremium(result.saldo_pendiente || 0)}`);
        setShowPagoDialog(false); loadCartera(); loadResumen();
      } else { toast.error(result?.error || 'Error al registrar pago'); }
    } catch { toast.error('Error inesperado'); }
    setIsSubmittingPago(false);
  };

  const handleViewComprobante = async (url: string) => {
    try {
      const supabase = getBrowserClient();
      const { data } = await supabase.storage.from('policy-documents').createSignedUrl(url, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch { toast.error('Error al obtener comprobante'); }
  };

  const handleOpenHistorial = async (item: CarteraWithPolicy) => {
    setHistorialCartera(item); setShowHistorialDialog(true); setIsLoadingHistorial(true);
    try {
      const supabase = getBrowserClient();
      const [pR, cR] = await Promise.all([
        (supabase as any).from('pagos').select('*').eq('cartera_id', item.id).order('fecha_pago', { ascending: false }),
        (supabase as any).from('cuotas_acuerdo').select('*').eq('cartera_id', item.id).order('numero_cuota', { ascending: true }),
      ]);
      setHistorialPagos((pR.data || []) as PagoRegistro[]);
      setHistorialCuotas((cR.data || []) as CuotaAcuerdo[]);
    } catch { toast.error('Error al cargar historial'); }
    setIsLoadingHistorial(false);
  };

  const totalPages = Math.ceil(total / pageSize);
  if (isLoadingTenant) return <LoadingScreen />;

  return (
    <div className="space-y-5 p-4 md:p-6" data-testid="cartera-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cartera</h1>
        <p className="text-sm text-muted-foreground">{tenantName}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Cartera Total</p><p className="text-2xl font-bold text-slate-900">{formatPremium(resumen.totalCartera)}</p></div><Wallet className="w-9 h-9 text-slate-400 opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Recaudado</p><p className="text-2xl font-bold text-green-600">{formatPremium(resumen.totalRecaudado)}</p></div><CheckCircle className="w-9 h-9 text-green-400 opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pendiente por Cobrar</p><p className="text-2xl font-bold text-amber-600">{formatPremium(resumen.totalPendiente)}</p></div><Clock className="w-9 h-9 text-amber-400 opacity-50" /></div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Todas', count: resumen.countPendiente + resumen.countAbono + resumen.countPagada },
          { key: 'pendiente', label: 'Pendientes', count: resumen.countPendiente },
          { key: 'abono', label: 'Con abono', count: resumen.countAbono },
          { key: 'pagada', label: 'Pagadas', count: resumen.countPagada },
        ].map(tab => (
          <Button key={tab.key} variant={activeTab === tab.key ? 'default' : 'outline'} size="sm"
            onClick={() => { setActiveTab(tab.key as typeof activeTab); setPage(1); }}>{tab.label} ({tab.count})</Button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por poliza, cliente o remision..." value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : cartera.length === 0 ? (
            <div className="text-center text-muted-foreground p-12"><Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No se encontraron registros</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="text-xs">Remision</TableHead>
                  <TableHead className="text-xs">Poliza</TableHead>
                  <TableHead className="text-xs">Anexo</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Metodo</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">Pagado</TableHead>
                  <TableHead className="text-xs text-right">Saldo</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartera.map((item) => (
                  <TableRow key={item.id} className="text-xs">
                    <TableCell className="py-2"><span className="font-mono text-[11px] text-slate-500">{item.remision?.numero_remision || '-'}</span></TableCell>
                    <TableCell className="py-2 font-medium text-xs">{item.policy?.policy_number}</TableCell>
                    <TableCell className="py-2 text-xs">{item.policy?.anexo || '00'}</TableCell>
                    <TableCell className="py-2 text-xs whitespace-nowrap">{item.policy?.clients?.full_name || 'N/A'}</TableCell>
                    <TableCell className="py-2 text-xs">{METODO_LABELS[item.metodo_pago]}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium">{formatPremium(item.valor_total)}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium text-green-600">{formatPremium(item.total_pagado)}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium text-amber-600">{formatPremium(item.saldo_pendiente)}</TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${ESTADO_COLORS[item.estado]}`}>{ESTADO_LABELS[item.estado]}</Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link href={`/polizas/${item.policy_id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button></Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenMetodo(item)}><Settings2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenHistorial(item)}><FileText className="w-3.5 h-3.5" /></Button>
                        {item.estado !== 'pagada' && (
                          <Button size="sm" onClick={() => handleOpenPago(item)} className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2">
                            <DollarSign className="w-3 h-3 mr-1" />Pagar
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm">Pagina {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* Dialog: Metodo de Pago */}
      <Dialog open={showMetodoDialog} onOpenChange={setShowMetodoDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Metodo de Pago</DialogTitle>
            <DialogDescription>Poliza {selectedForMetodo?.policy?.policy_number} - Saldo: {formatPremium(selectedForMetodo?.saldo_pendiente || 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
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
              <div className="space-y-2">
                <Label>Financiera</Label>
                <Input placeholder="Nombre de la financiera" value={metodoForm.financiera}
                  onChange={(e) => setMetodoForm(prev => ({ ...prev, financiera: e.target.value }))} />
              </div>
            )}
            {metodoForm.metodo_pago === 'acuerdo_pago' && (
              <>
                <div className="space-y-2">
                  <Label>Numero de cuotas</Label>
                  <Select value={metodoForm.num_cuotas} onValueChange={(v) => generateCuotas(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[3,4,5,6,7,8,9,10,11,12].map(n => (<SelectItem key={n} value={n.toString()}>{n} cuotas</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {metodoForm.cuotas.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {metodoForm.cuotas.map((cuota, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg text-sm">
                        <span className="text-xs font-medium text-muted-foreground w-14">Cuota {i+1}</span>
                        <Input type="number" value={cuota.valor} onChange={(e) => { const u=[...metodoForm.cuotas]; u[i].valor=e.target.value; setMetodoForm(p=>({...p,cuotas:u})); }} className="flex-1 h-8 text-sm" />
                        <Input type="date" value={cuota.fecha} onChange={(e) => { const u=[...metodoForm.cuotas]; u[i].fecha=e.target.value; setMetodoForm(p=>({...p,cuotas:u})); }} className="flex-1 h-8 text-sm" />
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
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>Poliza {selectedCartera?.policy?.policy_number} - Saldo: {formatPremium(selectedCartera?.saldo_pendiente || 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 overflow-y-auto flex-1">
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Valor total:</span><span className="font-medium">{formatPremium(selectedCartera?.valor_total || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pagado:</span><span className="font-medium text-green-600">{formatPremium(selectedCartera?.total_pagado || 0)}</span></div>
              <div className="flex justify-between font-semibold"><span>Saldo:</span><span className="text-amber-600">{formatPremium(selectedCartera?.saldo_pendiente || 0)}</span></div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Fecha de pago</Label>
              <Input type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Total a pagar</Label>
              <Input type="text" inputMode="numeric" placeholder="$0"
                value={pagoTotal ? '$' + parseInt(pagoTotal.replace(/\D/g, '') || '0').toLocaleString('es-CO') : ''}
                onChange={(e) => setPagoTotal(e.target.value.replace(/\D/g, ''))}
                className="font-semibold text-lg h-11" />
            </div>
            {getRawPago() > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm">
                <p className="font-medium text-blue-800 text-xs mb-1">Desglose automatico:</p>
                <div className="flex justify-between text-blue-700 text-xs"><span>Prima:</span><span>{formatPremium(calcularDesglose(getRawPago()).prima)}</span></div>
                <div className="flex justify-between text-blue-700 text-xs"><span>IVA (19%):</span><span>{formatPremium(calcularDesglose(getRawPago()).iva)}</span></div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-sm">Notas (opcional)</Label>
              <Textarea placeholder="Referencia de pago..." value={pagoNotas} onChange={(e) => setPagoNotas(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Comprobante (opcional)</Label>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => { const f=e.target.files?.[0]; if(f) setComprobanteFile(f); e.target.value=''; }} className="hidden" />
              {comprobanteFile ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2">
                  <Paperclip className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs text-green-700 flex-1 truncate">{comprobanteFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setComprobanteFile(null)} className="text-red-500 h-6 px-2 text-xs">Quitar</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full h-8 text-xs">
                  <Upload className="w-3.5 h-3.5 mr-1" />Adjuntar comprobante
                </Button>
              )}
            </div>
            {selectedCartera && getRawPago() > 0 && getRawPago() < selectedCartera.saldo_pendiente && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                Abono parcial. Saldo restante: {formatPremium(selectedCartera.saldo_pendiente - getRawPago())}
              </div>
            )}
            {selectedCartera && getRawPago() >= selectedCartera.saldo_pendiente && getRawPago() > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                Cubre el saldo total. Quedara como pagada.
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
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Historial de Pagos</DialogTitle>
            <DialogDescription>Poliza {historialCartera?.policy?.policy_number} - {METODO_LABELS[historialCartera?.metodo_pago || 'contado']}</DialogDescription>
          </DialogHeader>
          {isLoadingHistorial ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Valor total:</span><span className="font-medium">{formatPremium(historialCartera?.valor_total || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pagado:</span><span className="font-medium text-green-600">{formatPremium(historialCartera?.total_pagado || 0)}</span></div>
                <div className="flex justify-between font-semibold"><span>Saldo:</span><span className={historialCartera?.saldo_pendiente === 0 ? 'text-green-600' : 'text-amber-600'}>{formatPremium(historialCartera?.saldo_pendiente || 0)}</span></div>
              </div>
              {historialCuotas.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Cuotas del Acuerdo</h4>
                  <div className="space-y-1">
                    {historialCuotas.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-slate-50 p-2 rounded text-xs">
                        <span className="font-medium">Cuota {c.numero_cuota}</span>
                        <span>{formatPremium(c.valor_cuota)}</span>
                        <span className="text-muted-foreground">{formatDate(c.fecha_vencimiento)}</span>
                        <Badge variant="outline" className={`text-[10px] ${c.estado === 'pagada' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{c.estado === 'pagada' ? 'Pagada' : 'Pendiente'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h4 className="font-medium text-sm mb-2">Pagos ({historialPagos.length})</h4>
                {historialPagos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay pagos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {historialPagos.map(p => (
                      <div key={p.id} className="bg-green-50 p-2.5 rounded-lg text-sm space-y-1">
                        <div className="flex justify-between"><span className="font-medium text-xs">{formatDate(p.fecha_pago)}</span><span className="font-bold text-green-700">{formatPremium(p.monto_total)}</span></div>
                        <div className="flex gap-3 text-[11px] text-muted-foreground"><span>Prima: {formatPremium(p.monto_prima)}</span><span>IVA: {formatPremium(p.monto_iva)}</span></div>
                        {p.notas && <p className="text-[11px] text-muted-foreground">{p.notas}</p>}
                        {p.comprobante_url && (
                          <button onClick={() => handleViewComprobante(p.comprobante_url!)} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800">
                            <File className="w-3 h-3" />{p.comprobante_name || 'Ver comprobante'}
                          </button>
                        )}
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
