'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
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
  Wallet, FileText, Settings2, Upload, Paperclip, File, ChevronDown, Landmark, CalendarClock,
  Ban, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface CarteraWithPolicy {
  id: string;
  policy_id: string;
  remision_id: string;
  metodo_pago: 'contado' | 'financiado' | 'acuerdo_pago';
  estado: 'pendiente' | 'abono' | 'pagada' | 'castigada';
  valor_prima: number;
  valor_iva: number;
  valor_gastos: number;
  valor_total: number;
  total_pagado: number;
  saldo_pendiente: number;
  financiera: string | null;
  valor_cuota_financiada: number | null;
  fecha_desembolso: string | null;
  fecha_ingreso: string;
  fecha_ultimo_pago: string | null;
  remision: { numero_remision: string } | null;
  policy: {
    id: string;
    policy_number: string;
    anexo: string | null;
    insurer: string;
    line: string;
    status: string;
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
const ESTADO_LABELS: Record<string, string> = { pendiente: 'Pendiente', abono: 'Abono', pagada: 'Pagada', castigada: 'Castigada' };
const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-300',
  abono: 'bg-blue-50 text-blue-700 border-blue-300',
  pagada: 'bg-green-50 text-green-700 border-green-300',
  castigada: 'bg-red-50 text-red-700 border-red-300',
};

const getCuotaStatusStyle = (cuota: CuotaAcuerdo) => {
  if (cuota.estado === 'pagada') {
    return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'bg-green-50 text-green-700 border-green-300', label: `Pagada${cuota.fecha_pago ? ' - ' + cuota.fecha_pago : ''}` };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const venc = new Date(cuota.fecha_vencimiento + 'T00:00:00');
  if (venc < today) {
    return { bg: 'bg-red-50 border-red-300', text: 'text-red-700', badge: 'bg-red-50 text-red-700 border-red-300', label: 'Vencida' };
  }
  const diffDays = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    return { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-300', label: `Vence en ${diffDays}d` };
  }
  return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', badge: 'bg-slate-50 text-slate-600 border-slate-300', label: 'Pendiente' };
};

const isPolicyCancelled = (item: CarteraWithPolicy) => item.policy?.status === 'cancelada';

export default function CarteraPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<'pendiente' | 'abono' | 'pagada' | 'castigada' | 'all'>('all');
  const [cartera, setCartera] = useState<CarteraWithPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [resumen, setResumen] = useState({ totalCartera: 0, totalRecaudado: 0, totalPendiente: 0, countPendiente: 0, countAbono: 0, countPagada: 0, countCastigada: 0, countFinanciado: 0, countAcuerdos: 0 });

  const [showPagoDialog, setShowPagoDialog] = useState(false);
  const [selectedCartera, setSelectedCartera] = useState<CarteraWithPolicy | null>(null);
  const [pagoTotal, setPagoTotal] = useState('');
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [pagoNotas, setPagoNotas] = useState('');
  const [comprobanteFile, setComprobanteFile] = useState<globalThis.File | null>(null);
  const [isSubmittingPago, setIsSubmittingPago] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [payingCuotaId, setPayingCuotaId] = useState<string | null>(null);

  const [showMetodoDialog, setShowMetodoDialog] = useState(false);
  const [selectedForMetodo, setSelectedForMetodo] = useState<CarteraWithPolicy | null>(null);
  const [metodoForm, setMetodoForm] = useState({ metodo_pago: 'contado', financiera: '', fecha_desembolso: '', num_cuotas: '3', cuotas: [] as { valor: string; fecha: string }[] });
  const [isSubmittingMetodo, setIsSubmittingMetodo] = useState(false);

  const [showHistorialDialog, setShowHistorialDialog] = useState(false);
  const [historialCartera, setHistorialCartera] = useState<CarteraWithPolicy | null>(null);
  const [historialPagos, setHistorialPagos] = useState<PagoRegistro[]>([]);
  const [historialCuotas, setHistorialCuotas] = useState<CuotaAcuerdo[]>([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);

  const [showCastigarDialog, setShowCastigarDialog] = useState(false);
  const [castigarItem, setCastigarItem] = useState<CarteraWithPolicy | null>(null);
  const [isSubmittingCastigar, setIsSubmittingCastigar] = useState(false);

  // Report state
  const [reportTab, setReportTab] = useState<'none' | 'financiado' | 'acuerdos'>('none');
  const [financiadoData, setFinanciadoData] = useState<CarteraWithPolicy[]>([]);
  const [acuerdosData, setAcuerdosData] = useState<CarteraWithPolicy[]>([]);
  const [expandedAcuerdo, setExpandedAcuerdo] = useState<string | null>(null);
  const [acuerdosCuotasMap, setAcuerdosCuotasMap] = useState<Record<string, CuotaAcuerdo[]>>({});
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportSearchQuery, setReportSearchQuery] = useState('');

  const loadCartera = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      let query = supabase
        .from('cartera')
        .select(`*, remision:remisiones(numero_remision), policy:policies!inner(id, policy_number, anexo, insurer, line, status, start_date, end_date, clients(full_name), insurance_line:insurance_lines(name))`, { count: 'exact' })
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
      const { data } = await supabase.from('cartera').select('estado, metodo_pago, valor_total, total_pagado, saldo_pendiente, policy:policies!inner(status)').eq('tenant_id', tenantId);
      if (data) {
        let totalCartera = 0, totalRecaudado = 0, totalPendiente = 0, countPendiente = 0, countAbono = 0, countPagada = 0, countCastigada = 0, countFinanciado = 0, countAcuerdos = 0;
        data.forEach((c: any) => {
          totalCartera += c.valor_total || 0; totalRecaudado += c.total_pagado || 0; totalPendiente += c.saldo_pendiente || 0;
          if (c.estado === 'pendiente') countPendiente++;
          else if (c.estado === 'abono') countAbono++;
          else if (c.estado === 'pagada') countPagada++;
          else if (c.estado === 'castigada') countCastigada++;
          const policyStatus = c.policy?.status;
          if (c.metodo_pago === 'financiado' && policyStatus !== 'cancelada') countFinanciado++;
          if (c.metodo_pago === 'acuerdo_pago' && c.estado !== 'pagada' && c.estado !== 'castigada' && policyStatus !== 'cancelada') countAcuerdos++;
        });
        setResumen({ totalCartera, totalRecaudado, totalPendiente, countPendiente, countAbono, countPagada, countCastigada, countFinanciado, countAcuerdos });
      }
    } catch (e) { console.error(e); }
  }, [tenantId]);

  const applyReportSearch = (items: CarteraWithPolicy[]) => {
    if (!reportSearchQuery) return items;
    const q = reportSearchQuery.toLowerCase();
    return items.filter(c =>
      c.policy?.policy_number?.toLowerCase().includes(q) ||
      c.policy?.clients?.full_name?.toLowerCase().includes(q) ||
      c.remision?.numero_remision?.toLowerCase().includes(q) ||
      c.financiera?.toLowerCase().includes(q)
    );
  };

  const loadFinanciado = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingReport(true);
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase
        .from('cartera')
        .select(`*, remision:remisiones(numero_remision), policy:policies!inner(id, policy_number, anexo, insurer, line, status, start_date, end_date, clients(full_name), insurance_line:insurance_lines(name))`)
        .eq('tenant_id', tenantId)
        .eq('metodo_pago', 'financiado')
        .order('fecha_ingreso', { ascending: false });

      if (error) { console.error(error); setIsLoadingReport(false); return; }

      const today = new Date().toISOString().split('T')[0];
      let filtered = ((data || []) as CarteraWithPolicy[]).filter(item => {
        if (isPolicyCancelled(item)) return false;
        if (item.estado === 'castigada') return false;
        if (item.policy?.end_date && item.policy.end_date < today) return false;
        if (dateFrom && item.fecha_desembolso && item.fecha_desembolso < dateFrom) return false;
        if (dateTo && item.fecha_desembolso && item.fecha_desembolso > dateTo) return false;
        return true;
      });
      setFinanciadoData(filtered);
    } catch (e) { console.error(e); }
    setIsLoadingReport(false);
  }, [tenantId, dateFrom, dateTo]);

  const loadAcuerdos = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingReport(true);
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase
        .from('cartera')
        .select(`*, remision:remisiones(numero_remision), policy:policies!inner(id, policy_number, anexo, insurer, line, status, start_date, end_date, clients(full_name), insurance_line:insurance_lines(name))`)
        .eq('tenant_id', tenantId)
        .eq('metodo_pago', 'acuerdo_pago')
        .neq('estado', 'pagada')
        .neq('estado', 'castigada')
        .order('fecha_ingreso', { ascending: false });

      if (error) { console.error(error); setIsLoadingReport(false); return; }

      let filtered = ((data || []) as CarteraWithPolicy[]).filter(item => {
        if (isPolicyCancelled(item)) return false;
        if (dateFrom && item.fecha_ingreso < dateFrom) return false;
        if (dateTo && item.fecha_ingreso > dateTo) return false;
        return true;
      });
      setAcuerdosData(filtered);
      setExpandedAcuerdo(null);

      if (filtered.length > 0) {
        const ids = filtered.map(f => f.id);
        const { data: cuotasData } = await (supabase as any)
          .from('cuotas_acuerdo').select('*').in('cartera_id', ids).order('numero_cuota', { ascending: true });
        const map: Record<string, CuotaAcuerdo[]> = {};
        (cuotasData || []).forEach((c: any) => {
          if (!map[c.cartera_id]) map[c.cartera_id] = [];
          map[c.cartera_id].push(c as CuotaAcuerdo);
        });
        setAcuerdosCuotasMap(map);
      } else {
        setAcuerdosCuotasMap({});
      }
    } catch (e) { console.error(e); }
    setIsLoadingReport(false);
  }, [tenantId, dateFrom, dateTo]);

  useEffect(() => { if (!isLoadingTenant && tenantId) { loadCartera(); loadResumen(); } }, [isLoadingTenant, tenantId, loadCartera, loadResumen]);
  useEffect(() => {
    if (!tenantId) return;
    if (reportTab === 'financiado') loadFinanciado();
    else if (reportTab === 'acuerdos') loadAcuerdos();
  }, [reportTab, tenantId, loadFinanciado, loadAcuerdos]);

  const handleOpenMetodo = (item: CarteraWithPolicy) => {
    setSelectedForMetodo(item);
    setMetodoForm({ metodo_pago: item.metodo_pago, financiera: item.financiera || '', fecha_desembolso: item.fecha_desembolso || '', num_cuotas: '3', cuotas: [] });
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
      if (metodoForm.metodo_pago === 'financiado') {
        updateData.financiera = metodoForm.financiera;
        updateData.valor_cuota_financiada = null;
        updateData.fecha_desembolso = metodoForm.fecha_desembolso || null;
      } else {
        updateData.financiera = null;
        updateData.valor_cuota_financiada = null;
        updateData.fecha_desembolso = null;
      }

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
      loadCartera(); loadResumen();
      if (reportTab === 'financiado') loadFinanciado();
      if (reportTab === 'acuerdos') loadAcuerdos();
    } catch { toast.error('Error inesperado'); }
    setIsSubmittingMetodo(false);
  };

  const handleOpenPago = (item: CarteraWithPolicy) => {
    setPayingCuotaId(null);
    setSelectedCartera(item); setPagoTotal(''); setPagoFecha(new Date().toISOString().split('T')[0]); setPagoNotas(''); setComprobanteFile(null); setShowPagoDialog(true);
  };

  const handlePayCuota = (carteraItem: CarteraWithPolicy, cuota: CuotaAcuerdo) => {
    setPayingCuotaId(cuota.id);
    setSelectedCartera(carteraItem);
    setPagoTotal(Math.round(cuota.valor_cuota).toString());
    setPagoFecha(new Date().toISOString().split('T')[0]);
    setPagoNotas(`Pago cuota ${cuota.numero_cuota}`);
    setComprobanteFile(null);
    setShowPagoDialog(true);
  };

  const getRawPago = (): number => parseInt(pagoTotal.replace(/\D/g, '') || '0');
  const calcularDesglose = (v: number) => {
    if (selectedCartera && selectedCartera.valor_total > 0) {
      const prima = Math.round(v * (selectedCartera.valor_prima || 0) / selectedCartera.valor_total);
      const gastos = Math.round(v * (selectedCartera.valor_gastos || 0) / selectedCartera.valor_total);
      const iva = v - prima - gastos;
      return { prima, gastos, iva, total: v };
    }
    const prima = Math.round(v / 1.19);
    return { prima, gastos: 0, iva: v - prima, total: v };
  };

  const handleSubmitPago = async () => {
    if (!selectedCartera) return;
    const montoTotal = getRawPago();
    const { prima, iva } = calcularDesglose(montoTotal);
    if (montoTotal <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    setIsSubmittingPago(true);
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

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
        p_cartera_id: selectedCartera.id,
        p_fecha_pago: pagoFecha,
        p_monto_prima: prima,
        p_monto_iva: iva,
        p_monto_total: montoTotal,
        p_notas: pagoNotas || null,
        p_user_id: user?.id || null,
        p_comprobante_url: compUrl,
        p_comprobante_name: compName,
      });

      if (error) { toast.error('Error: ' + error.message); setIsSubmittingPago(false); return; }
      const result = data as { success: boolean; pago_id?: string; estado?: string; saldo_pendiente?: number; error?: string };

      if (result?.success) {
        if (payingCuotaId) {
          await (supabase as any).from('cuotas_acuerdo')
            .update({ estado: 'pagada', fecha_pago: pagoFecha })
            .eq('id', payingCuotaId);
          setPayingCuotaId(null);
        }
        toast.success(result.estado === 'pagada' ? 'Pago total registrado' : `Abono registrado - Saldo: ${formatPremium(result.saldo_pendiente || 0)}`);
        setShowPagoDialog(false); loadCartera(); loadResumen();
        if (reportTab === 'acuerdos') loadAcuerdos();
        if (reportTab === 'financiado') loadFinanciado();
      } else { toast.error(result?.error || 'Error al registrar pago'); }
    } catch { toast.error('Error inesperado'); }
    setIsSubmittingPago(false);
  };

  const handleCastigar = async () => {
    if (!castigarItem) return;
    setIsSubmittingCastigar(true);
    try {
      const supabase = getBrowserClient();
      const { error } = await (supabase as any).from('cartera')
        .update({ estado: 'castigada', updated_at: new Date().toISOString() })
        .eq('id', castigarItem.id);
      if (error) { toast.error('Error: ' + error.message); setIsSubmittingCastigar(false); return; }
      toast.success('Cartera marcada como castigada');
      setShowCastigarDialog(false); setCastigarItem(null);
      loadCartera(); loadResumen();
      if (reportTab === 'financiado') loadFinanciado();
      if (reportTab === 'acuerdos') loadAcuerdos();
    } catch { toast.error('Error inesperado'); }
    setIsSubmittingCastigar(false);
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

  const toggleAcuerdo = (carteraId: string) => {
    setExpandedAcuerdo(prev => prev === carteraId ? null : carteraId);
  };

  const totalPages = Math.ceil(total / pageSize);
  if (isLoadingTenant) return <LoadingScreen />;

  const filteredFinanciado = applyReportSearch(financiadoData);
  const filteredAcuerdos = applyReportSearch(acuerdosData);

  return (
    <div className="space-y-5 p-4 md:p-6" data-testid="cartera-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cartera</h1>
        <p className="text-sm text-muted-foreground">{tenantName}</p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Todas', count: resumen.countPendiente + resumen.countAbono + resumen.countPagada + resumen.countCastigada },
          { key: 'pendiente', label: 'Pendientes', count: resumen.countPendiente },
          { key: 'abono', label: 'Con abono', count: resumen.countAbono },
          { key: 'pagada', label: 'Pagadas', count: resumen.countPagada },
          { key: 'castigada', label: 'Castigadas', count: resumen.countCastigada },
        ].map(tab => (
          <Button key={tab.key} size="sm"
            variant={reportTab === 'none' && activeTab === tab.key ? 'default' : 'outline'}
            className={tab.key === 'castigada' && reportTab === 'none' && activeTab === tab.key ? 'bg-red-600 hover:bg-red-700' : tab.key === 'castigada' ? 'border-red-300 text-red-600 hover:bg-red-50' : ''}
            onClick={() => { setActiveTab(tab.key as typeof activeTab); setReportTab('none'); setPage(1); }}>{tab.label} ({tab.count})</Button>
        ))}
      </div>

      {/* Report tabs */}
      <div className="border-t pt-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Reportes de Control</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={reportTab === 'financiado' ? 'default' : 'outline'}
            size="sm"
            className={reportTab === 'financiado' ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'}
            onClick={() => { setReportTab(reportTab === 'financiado' ? 'none' : 'financiado'); setReportSearchQuery(''); }}
          >
            <Landmark className="w-3.5 h-3.5 mr-1" />Financiado ({resumen.countFinanciado})
          </Button>
          <Button
            variant={reportTab === 'acuerdos' ? 'default' : 'outline'}
            size="sm"
            className={reportTab === 'acuerdos' ? 'bg-violet-600 hover:bg-violet-700' : 'border-violet-300 text-violet-600 hover:bg-violet-50'}
            onClick={() => { setReportTab(reportTab === 'acuerdos' ? 'none' : 'acuerdos'); setReportSearchQuery(''); }}
          >
            <CalendarClock className="w-3.5 h-3.5 mr-1" />Acuerdos de Pago ({resumen.countAcuerdos})
          </Button>
          {reportTab !== 'none' && (
            <>
              <div className="h-6 w-px bg-slate-200 mx-1" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Desde:</span>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-7 w-36 text-xs" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Hasta:</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-7 w-36 text-xs" />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }} className="h-7 text-xs text-red-500 hover:text-red-700">Limpiar</Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      {reportTab === 'none' ? (
        <>
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
                      <TableRow key={item.id} className={`text-xs ${item.estado === 'castigada' ? 'opacity-60' : ''}`}>
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
                            {item.estado !== 'pagada' && item.estado !== 'castigada' && (
                              <>
                                <Button size="sm" onClick={() => handleOpenPago(item)} className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2">
                                  <DollarSign className="w-3 h-3 mr-1" />Pagar
                                </Button>
                                {item.saldo_pendiente > 0 && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => { setCastigarItem(item); setShowCastigarDialog(true); }}>
                                    <Ban className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </>
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
        </>
      ) : reportTab === 'financiado' ? (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por poliza, cliente o financiera..." value={reportSearchQuery}
              onChange={(e) => setReportSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoadingReport ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
              ) : filteredFinanciado.length === 0 ? (
                <div className="text-center text-muted-foreground p-12">
                  <Landmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay polizas financiadas activas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-indigo-50/50">
                      <TableHead className="text-xs">Poliza</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs text-right">Valor Financiado</TableHead>
                      <TableHead className="text-xs">Financiera</TableHead>
                      <TableHead className="text-xs">Fecha Desembolso</TableHead>
                      <TableHead className="text-xs">Vence Poliza</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFinanciado.map(item => (
                      <TableRow key={item.id} className="text-xs">
                        <TableCell className="py-2 font-medium">{item.policy?.policy_number}</TableCell>
                        <TableCell className="py-2 whitespace-nowrap">{item.policy?.clients?.full_name || 'N/A'}</TableCell>
                        <TableCell className="py-2 text-right font-medium">{formatPremium(item.valor_total)}</TableCell>
                        <TableCell className="py-2">{item.financiera || <span className="text-slate-300">Sin asignar</span>}</TableCell>
                        <TableCell className="py-2">{item.fecha_desembolso ? formatDate(item.fecha_desembolso) : <span className="text-slate-300">Sin fecha</span>}</TableCell>
                        <TableCell className="py-2">{item.policy?.end_date ? formatDate(item.policy.end_date) : '-'}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${ESTADO_COLORS[item.estado]}`}>{ESTADO_LABELS[item.estado]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por poliza, cliente o remision..." value={reportSearchQuery}
              onChange={(e) => setReportSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoadingReport ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
              ) : filteredAcuerdos.length === 0 ? (
                <div className="text-center text-muted-foreground p-12">
                  <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay acuerdos de pago activos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-violet-50/50">
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">Poliza</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Pagado</TableHead>
                      <TableHead className="text-xs text-right">Saldo</TableHead>
                      <TableHead className="text-xs text-center">Cuotas</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAcuerdos.map(item => {
                      const cuotas = acuerdosCuotasMap[item.id] || [];
                      const cuotasPagadas = cuotas.filter(c => c.estado === 'pagada').length;
                      const cuotasVencidas = cuotas.filter(c => {
                        if (c.estado === 'pagada') return false;
                        return new Date(c.fecha_vencimiento + 'T00:00:00') < new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
                      }).length;
                      return (
                        <Fragment key={item.id}>
                          <TableRow className="text-xs cursor-pointer hover:bg-violet-50/50" onClick={() => toggleAcuerdo(item.id)}>
                            <TableCell className="py-2 pl-3">
                              {expandedAcuerdo === item.id ? <ChevronDown className="w-3.5 h-3.5 text-violet-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            </TableCell>
                            <TableCell className="py-2 font-medium">{item.policy?.policy_number}</TableCell>
                            <TableCell className="py-2 whitespace-nowrap">{item.policy?.clients?.full_name || 'N/A'}</TableCell>
                            <TableCell className="py-2 text-right font-medium">{formatPremium(item.valor_total)}</TableCell>
                            <TableCell className="py-2 text-right font-medium text-green-600">{formatPremium(item.total_pagado)}</TableCell>
                            <TableCell className="py-2 text-right font-medium text-amber-600">{formatPremium(item.saldo_pendiente)}</TableCell>
                            <TableCell className="py-2 text-center">
                              <span className="text-xs">{cuotasPagadas}/{cuotas.length}</span>
                              {cuotasVencidas > 0 && <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-300">{cuotasVencidas} venc.</Badge>}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${ESTADO_COLORS[item.estado]}`}>{ESTADO_LABELS[item.estado]}</Badge>
                            </TableCell>
                          </TableRow>
                          {expandedAcuerdo === item.id && (
                            <TableRow>
                              <TableCell colSpan={8} className="p-0">
                                <div className="bg-violet-50/30 px-4 py-3 border-y border-violet-100">
                                  {cuotas.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-2">No hay cuotas registradas. Configura el acuerdo desde el boton de metodo de pago.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium px-2 mb-1">
                                        <span className="w-16">CUOTA</span>
                                        <span className="flex-1">VALOR</span>
                                        <span className="w-28">VENCIMIENTO</span>
                                        <span className="w-24">ESTADO</span>
                                        <span className="w-16"></span>
                                      </div>
                                      {cuotas.map(cuota => {
                                        const status = getCuotaStatusStyle(cuota);
                                        return (
                                          <div key={cuota.id} className={`flex items-center gap-3 p-2 rounded-lg border text-xs ${status.bg}`}>
                                            <span className="font-semibold w-16">Cuota {cuota.numero_cuota}</span>
                                            <span className="font-medium flex-1">{formatPremium(cuota.valor_cuota)}</span>
                                            <span className="text-muted-foreground w-28">{formatDate(cuota.fecha_vencimiento)}</span>
                                            <Badge variant="outline" className={`text-[10px] w-24 justify-center ${status.badge}`}>{status.label}</Badge>
                                            <div className="w-16 text-right">
                                              {cuota.estado !== 'pagada' && (
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePayCuota(item, cuota); }}
                                                  className="bg-green-600 hover:bg-green-700 h-6 text-[10px] px-2">
                                                  <DollarSign className="w-2.5 h-2.5 mr-0.5" />Pagar
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog: Castigar */}
      <Dialog open={showCastigarDialog} onOpenChange={setShowCastigarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" />Castigar Cartera</DialogTitle>
            <DialogDescription>
              Esta accion marcara la cartera de la poliza <span className="font-semibold">{castigarItem?.policy?.policy_number}</span> como castigada. El saldo pendiente de <span className="font-semibold text-red-600">{formatPremium(castigarItem?.saldo_pendiente || 0)}</span> se considerara como perdida.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
            <p className="font-medium">Esta accion:</p>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              <li>Marca el registro como castigada (no cobrable)</li>
              <li>Lo remueve de los reportes de control</li>
              <li>El historial de pagos previos se conserva</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCastigarDialog(false)} disabled={isSubmittingCastigar}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCastigar} disabled={isSubmittingCastigar}>
              {isSubmittingCastigar ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><Ban className="w-4 h-4 mr-2" />Castigar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <>
                <div className="space-y-2">
                  <Label>Financiera</Label>
                  <Input placeholder="Nombre de la financiera" value={metodoForm.financiera}
                    onChange={(e) => setMetodoForm(prev => ({ ...prev, financiera: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Desembolso</Label>
                  <Input type="date" value={metodoForm.fecha_desembolso}
                    onChange={(e) => setMetodoForm(prev => ({ ...prev, fecha_desembolso: e.target.value }))} />
                </div>
              </>
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
