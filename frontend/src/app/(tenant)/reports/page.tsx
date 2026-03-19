'use client';

// =====================================================
// PÁGINA: Reportes y Analytics
// /reports
// Módulo 04 del CRM Multi-tenant
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  ExecutiveDashboard,
  AgentPerformanceTable,
  PortfolioCharts,
  ClaimsAnalytics,
  RenewalReport,
  CommissionsReport,
} from '@/components/modules/reports';
import {
  ExecutiveDashboardData,
  AgentPerformanceData,
  PortfolioByLine,
  PortfolioByInsurer,
  PremiumTrend,
  ClaimsAnalytics as ClaimsAnalyticsType,
  RenewalReportItem,
  CommissionReportItem,
  LINE_LABELS,
} from '@/lib/validations/reports';
import {
  BarChart3,
  Users,
  PieChart,
  AlertTriangle,
  Calendar,
  Wallet,
  RefreshCw,
  Download,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface Agent {
  id: string;
  full_name: string;
}

export default function ReportsPage() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const supabase = getBrowserClient();
  
  // Estado de tabs y filtros
  const [activeTab, setActiveTab] = useState('dashboard');
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [renewalDays, setRenewalDays] = useState<number>(30);
  
  // Estado de datos
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dashboardData, setDashboardData] = useState<ExecutiveDashboardData | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformanceData[]>([]);
  const [portfolioByLine, setPortfolioByLine] = useState<PortfolioByLine[]>([]);
  const [portfolioByInsurer, setPortfolioByInsurer] = useState<PortfolioByInsurer[]>([]);
  const [premiumTrend, setPremiumTrend] = useState<PremiumTrend[]>([]);
  const [claimsData, setClaimsData] = useState<ClaimsAnalyticsType | null>(null);
  const [renewalData, setRenewalData] = useState<RenewalReportItem[]>([]);
  const [commissionsData, setCommissionsData] = useState<CommissionReportItem[]>([]);

  // Cargar agentes
  const loadAgents = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['agent', 'senior_agent', 'admin'])
      .order('full_name');
    if (data) setAgents(data);
  }, [tenantId, supabase]);

  // Cargar Dashboard
  const loadDashboard = useCallback(async () => {
    if (!tenantId) return;
    try {
      // Intentar RPC primero
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_executive_dashboard', {
        p_tenant_id: tenantId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (!error && data?.length > 0) {
        setDashboardData(data[0] as ExecutiveDashboardData);
        return;
      }
    } catch { /* RPC no disponible, usar fallback */ }
    
    // Fallback manual
    try {
      const { count: activePolicies } = await supabase.from('policies').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'activa');
      const { data: premiumData } = await supabase.from('policies').select('premium').eq('tenant_id', tenantId).eq('status', 'activa').gte('created_at', startDate).lte('created_at', endDate);
      const totalPremium = (premiumData as { premium: number }[] | null)?.reduce((sum, p) => sum + (p.premium || 0), 0) || 0;
      const { count: openClaims } = await supabase.from('claims').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('status', 'in', '("resolved","closed")');
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { count: renewals } = await supabase.from('policies').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'activa').gte('end_date', today).lte('end_date', in30Days);
      const { data: commData } = await supabase.from('policies').select('premium, commission_pct').eq('tenant_id', tenantId).eq('status', 'activa');
      const pendingComm = (commData as { premium: number; commission_pct: number }[] | null)?.reduce((sum, p) => sum + ((p.premium || 0) * (p.commission_pct || 0) / 100), 0) || 0;
      setDashboardData({
        active_policies_count: activePolicies || 0, total_premium_month: totalPremium, open_claims_count: openClaims || 0,
        renewals_next_30_days: renewals || 0, pending_commissions_total: pendingComm,
        active_policies_prev: 0, total_premium_prev: 0, open_claims_prev: 0,
      });
    } catch (e) { console.error('Dashboard fallback error:', e); }
  }, [tenantId, startDate, endDate, supabase]);

  // Cargar rendimiento de agentes
  const loadAgentPerformance = useCallback(async () => {
    if (!tenantId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_agent_performance', {
        p_tenant_id: tenantId,
        p_agent_id: selectedAgentId !== 'all' ? selectedAgentId : null,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (!error && data) setAgentPerformance(data as AgentPerformanceData[]);
    } catch { setAgentPerformance([]); }
  }, [tenantId, selectedAgentId, startDate, endDate, supabase]);

  // Cargar análisis de cartera
  const loadPortfolioAnalysis = useCallback(async () => {
    if (!tenantId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = supabase.rpc as any;
      const { data: lineData } = await rpc('get_portfolio_by_line', { p_tenant_id: tenantId });
      if (lineData) setPortfolioByLine(lineData as PortfolioByLine[]);
      const { data: insurerData } = await rpc('get_portfolio_by_insurer', { p_tenant_id: tenantId });
      if (insurerData) setPortfolioByInsurer(insurerData as PortfolioByInsurer[]);
      const { data: trendData } = await rpc('get_premium_trend', { p_tenant_id: tenantId });
      if (trendData) setPremiumTrend(trendData as PremiumTrend[]);
    } catch {
      // Fallback
      try {
        const { data: policies } = await supabase.from('policies').select('line, premium, insurer').eq('tenant_id', tenantId).eq('status', 'activa');
        if (policies) {
          type PolicyData = { line: string; premium: number; insurer: string };
          const typedPolicies = policies as PolicyData[];
          const totalPremium = typedPolicies.reduce((sum, p) => sum + (p.premium || 0), 0);
          const byLine = typedPolicies.reduce((acc, p) => {
            const line = p.line || 'otro';
            if (!acc[line]) acc[line] = { count: 0, premium: 0 };
            acc[line].count += 1; acc[line].premium += p.premium || 0;
            return acc;
          }, {} as Record<string, { count: number; premium: number }>);
          setPortfolioByLine(Object.entries(byLine).map(([line, data]) => ({ line, count: data.count, premium: data.premium, percentage: totalPremium > 0 ? (data.premium / totalPremium) * 100 : 0 })));
          const byInsurer = typedPolicies.reduce((acc, p) => {
            const insurer = p.insurer || 'Otro';
            if (!acc[insurer]) acc[insurer] = { count: 0, premium: 0 };
            acc[insurer].count += 1; acc[insurer].premium += p.premium || 0;
            return acc;
          }, {} as Record<string, { count: number; premium: number }>);
          setPortfolioByInsurer(Object.entries(byInsurer).map(([insurer, data]) => ({ insurer, count: data.count, premium: data.premium, percentage: totalPremium > 0 ? (data.premium / totalPremium) * 100 : 0 })));
        }
      } catch (e) { console.error('Portfolio fallback error:', e); }
    }
  }, [tenantId, supabase]);

  // Cargar análisis de siniestros
  const loadClaimsAnalytics = useCallback(async () => {
    if (!tenantId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_claims_analytics', { p_tenant_id: tenantId });
      if (!error && data?.length > 0) { setClaimsData(data[0] as ClaimsAnalyticsType); return; }
    } catch { /* fallback */ }
    try {
      const { data: claims } = await supabase.from('claims').select('status, claimed_amount, approved_amount').eq('tenant_id', tenantId);
      if (claims) {
        type ClaimData = { status: string; claimed_amount: number; approved_amount: number | null };
        const typedClaims = claims as ClaimData[];
        const total = typedClaims.length;
        const open = typedClaims.filter(c => !['resolved', 'closed'].includes(c.status)).length;
        const resolved = typedClaims.filter(c => ['resolved', 'closed'].includes(c.status)).length;
        const totalClaimed = typedClaims.reduce((sum, c) => sum + (c.claimed_amount || 0), 0);
        const totalApproved = typedClaims.reduce((sum, c) => sum + (c.approved_amount || 0), 0);
        const byStatus = typedClaims.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {} as Record<string, number>);
        setClaimsData({
          total_claims: total, open_claims: open, resolved_claims: resolved,
          avg_claimed_amount: total > 0 ? totalClaimed / total : 0,
          avg_approved_amount: resolved > 0 ? totalApproved / resolved : 0,
          total_claimed: totalClaimed, total_approved: totalApproved, loss_ratio: 0,
          claims_by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
          claims_by_line: [],
        });
      }
    } catch (e) { console.error('Claims fallback error:', e); }
  }, [tenantId, supabase]);

  // Cargar renovaciones
  const loadRenewalReport = useCallback(async () => {
    if (!tenantId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_renewal_report', { p_tenant_id: tenantId, p_days: renewalDays });
      if (!error && data) { setRenewalData(data as RenewalReportItem[]); return; }
    } catch { /* fallback */ }
    try {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + renewalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: policies } = await supabase.from('policies').select(`id, policy_number, insurer, line, premium, commission_pct, end_date, client:clients!inner(id, full_name, email, phone)`).eq('tenant_id', tenantId).eq('status', 'activa').gte('end_date', today).lte('end_date', futureDate).order('end_date', { ascending: true }) as any;
      if (policies) {
        const renewals: RenewalReportItem[] = policies.map((p: { id: string; policy_number: string; insurer: string; line: string; premium: number; commission_pct: number; end_date: string; client: { id: string; full_name: string; email: string | null; phone: string | null } }) => {
          const client = p.client;
          const endDate = new Date(p.end_date);
          const daysRemaining = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return { policy_id: p.id, policy_number: p.policy_number, client_id: client.id, client_name: client.full_name, client_email: client.email, client_phone: client.phone, insurer: p.insurer, line: p.line, premium: p.premium, commission: (p.premium * (p.commission_pct || 0)) / 100, end_date: p.end_date, days_remaining: daysRemaining, renewal_status: 'sin_gestion' as const };
        });
        setRenewalData(renewals);
      }
    } catch (e) { console.error('Renewal fallback error:', e); }
  }, [tenantId, renewalDays, supabase]);

  // Cargar comisiones
  const loadCommissionsReport = useCallback(async () => {
    if (!tenantId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_commissions_report', { p_tenant_id: tenantId, p_agent_id: selectedAgentId !== 'all' ? selectedAgentId : null, p_start_date: startDate, p_end_date: endDate });
      if (!error && data) { setCommissionsData(data as CommissionReportItem[]); return; }
    } catch { /* fallback */ }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: policies } = await supabase.from('policies').select(`id, policy_number, insurer, line, premium, commission_pct, status, created_at, client:clients!inner(full_name, agent_id)`).eq('tenant_id', tenantId).eq('status', 'activa').gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: false }) as any;
      if (policies) {
        const commissions: CommissionReportItem[] = policies.map((p: { id: string; policy_number: string; insurer: string; line: string; premium: number; commission_pct: number; status: string; created_at: string; client: { full_name: string; agent_id: string | null } }) => {
          const client = p.client;
          return { policy_id: p.id, policy_number: p.policy_number, client_name: client.full_name, insurer: p.insurer, line: p.line, premium: p.premium, commission_pct: p.commission_pct, commission_amount: (p.premium * (p.commission_pct || 0)) / 100, policy_status: p.status, created_at: p.created_at, agent_id: client.agent_id, agent_name: null };
        });
        setCommissionsData(commissions);
      }
    } catch (e) { console.error('Commissions fallback error:', e); }
  }, [tenantId, selectedAgentId, startDate, endDate, supabase]);

  // Cargar todos los datos
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadAgents(), loadDashboard(), loadAgentPerformance(), loadPortfolioAnalysis(), loadClaimsAnalytics(), loadRenewalReport(), loadCommissionsReport()]);
    setIsLoading(false);
  }, [loadAgents, loadDashboard, loadAgentPerformance, loadPortfolioAnalysis, loadClaimsAnalytics, loadRenewalReport, loadCommissionsReport]);

  useEffect(() => {
    if (!tenantLoading && tenantId) loadAllData();
  }, [tenantLoading, tenantId, loadAllData]);

  const handleRefresh = () => loadAllData();

  // Exportar a Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (dashboardData) {
      const dashboardSheet = XLSX.utils.json_to_sheet([{ 'Pólizas Activas': dashboardData.active_policies_count, 'Prima del Mes': dashboardData.total_premium_month, 'Siniestros Abiertos': dashboardData.open_claims_count, 'Renovaciones (30 días)': dashboardData.renewals_next_30_days, 'Comisiones Pendientes': dashboardData.pending_commissions_total }]);
      XLSX.utils.book_append_sheet(wb, dashboardSheet, 'Dashboard');
    }
    if (agentPerformance.length > 0) {
      const agentSheet = XLSX.utils.json_to_sheet(agentPerformance.map((a) => ({ Agente: a.agent_name, 'Pólizas Mes': a.policies_created_month, 'Prima Total': a.total_premium, Pipeline: a.pipeline_total, 'Ganadas Mes': a.pipeline_won_month, 'Tasa Cierre %': a.close_rate, 'Comisiones Mes': a.commissions_earned_month })));
      XLSX.utils.book_append_sheet(wb, agentSheet, 'Agentes');
    }
    if (renewalData.length > 0) {
      const renewalSheet = XLSX.utils.json_to_sheet(renewalData.map((r) => ({ Cliente: r.client_name, Teléfono: r.client_phone || '', Email: r.client_email || '', Póliza: r.policy_number, Aseguradora: r.insurer, Ramo: LINE_LABELS[r.line] || r.line, Prima: r.premium, Comisión: r.commission, 'Fecha Vencimiento': r.end_date, 'Días Restantes': r.days_remaining, Estado: r.renewal_status })));
      XLSX.utils.book_append_sheet(wb, renewalSheet, 'Renovaciones');
    }
    if (commissionsData.length > 0) {
      const commSheet = XLSX.utils.json_to_sheet(commissionsData.map((c) => ({ Fecha: new Date(c.created_at).toLocaleDateString('es-CO'), Póliza: c.policy_number, Cliente: c.client_name, Aseguradora: c.insurer, Ramo: LINE_LABELS[c.line] || c.line, Agente: c.agent_name || 'Sin asignar', Prima: c.premium, '% Comisión': c.commission_pct, Comisión: c.commission_amount })));
      XLSX.utils.book_append_sheet(wb, commSheet, 'Comisiones');
    }
    XLSX.writeFile(wb, `Reporte_CRM_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const setQuickPeriod = (months: number) => {
    const end = new Date();
    const start = subMonths(end, months);
    setStartDate(format(startOfMonth(start), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(end), 'yyyy-MM-dd'));
  };

  if (tenantLoading) {
    return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-slate-200 rounded" /><div className="h-64 bg-slate-200 rounded" /></div></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes y Analytics</h1>
          <p className="text-muted-foreground">Análisis y métricas de tu agencia</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
          <Button variant="default" size="sm" onClick={handleExportExcel} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />Exportar XLSX
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <Label className="text-xs">Período rápido</Label>
              <div className="flex gap-1 mt-1">
                {[1, 3, 6, 12].map((m) => (
                  <Button key={m} variant="outline" size="sm" className="text-xs px-2" onClick={() => setQuickPeriod(m)}>{m === 12 ? '1A' : `${m}M`}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="startDate" className="text-xs">Desde</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs">Hasta</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Agente</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los agentes</SelectItem>
                  {agents.map((agent) => (<SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ramo</Label>
              <Select value={selectedLine} onValueChange={setSelectedLine}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los ramos</SelectItem>
                  {Object.entries(LINE_LABELS).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Agentes</span></TabsTrigger>
          <TabsTrigger value="portfolio" className="flex items-center gap-2"><PieChart className="h-4 w-4" /><span className="hidden sm:inline">Cartera</span></TabsTrigger>
          <TabsTrigger value="claims" className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><span className="hidden sm:inline">Siniestros</span></TabsTrigger>
          <TabsTrigger value="renewals" className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Renovaciones</span></TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-2"><Wallet className="h-4 w-4" /><span className="hidden sm:inline">Comisiones</span></TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <ExecutiveDashboard data={dashboardData} isLoading={isLoading} />
          <PortfolioCharts byLineData={portfolioByLine} byInsurerData={portfolioByInsurer} trendData={premiumTrend} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="agents">
          <AgentPerformanceTable data={agentPerformance} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="portfolio">
          <PortfolioCharts byLineData={portfolioByLine} byInsurerData={portfolioByInsurer} trendData={premiumTrend} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="claims">
          <ClaimsAnalytics data={claimsData} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="renewals" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Label className="text-sm">Mostrar pólizas que vencen en:</Label>
                <Select value={renewalDays.toString()} onValueChange={(v) => setRenewalDays(Number(v))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 días</SelectItem>
                    <SelectItem value="60">60 días</SelectItem>
                    <SelectItem value="90">90 días</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={loadRenewalReport} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />Aplicar
                </Button>
              </div>
            </CardContent>
          </Card>
          <RenewalReport data={renewalData} isLoading={isLoading} onRefresh={loadRenewalReport} />
        </TabsContent>

        <TabsContent value="commissions">
          <CommissionsReport data={commissionsData} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
