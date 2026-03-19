'use client';

// =====================================================
// PÁGINA: Facturación
// /billing
// Módulo 05 del CRM Multi-tenant
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { LoadingScreen } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvoicesList } from '@/components/modules/billing/InvoicesList';
import { CommissionsPanel } from '@/components/modules/billing/CommissionsPanel';
import { CommissionRatesConfig } from '@/components/modules/billing/CommissionRatesConfig';
import {
  type BillingStats,
  type CommissionsSummary,
  formatCurrency
} from '@/lib/validations/billing';
import {
  Receipt,
  Wallet,
  Settings,
  ArrowLeft,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function BillingPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState('invoices');
  const [isLoading, setIsLoading] = useState(true);
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null);
  const [commissionsSummary, setCommissionsSummary] = useState<CommissionsSummary | null>(null);

  const loadStats = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      // Cargar estadísticas de cuotas
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('status, amount')
        .eq('tenant_id', tenantId);
      
      if (invoicesData) {
        type InvoiceData = { status: string; amount: number };
        const invoices = invoicesData as InvoiceData[];
        
        const stats: BillingStats = {
          total_invoices: invoices.length,
          total_pending: invoices.filter(i => i.status === 'pending').length,
          total_paid: invoices.filter(i => i.status === 'paid').length,
          total_overdue: invoices.filter(i => i.status === 'overdue').length,
          amount_pending: invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0),
          amount_paid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0),
          amount_overdue: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.amount || 0), 0)
        };
        setBillingStats(stats);
      }
      
      // Cargar resumen de comisiones
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select('status, amount')
        .eq('tenant_id', tenantId);
      
      if (commissionsData) {
        type CommissionData = { status: string; amount: number };
        const commissions = commissionsData as CommissionData[];
        
        const summary: CommissionsSummary = {
          total_pending: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0),
          total_collected: commissions.filter(c => c.status === 'collected').reduce((sum, c) => sum + (c.amount || 0), 0),
          total_void: commissions.filter(c => c.status === 'void').reduce((sum, c) => sum + (c.amount || 0), 0),
          count_pending: commissions.filter(c => c.status === 'pending').length,
          count_collected: commissions.filter(c => c.status === 'collected').length,
          count_void: commissions.filter(c => c.status === 'void').length
        };
        setCommissionsSummary(summary);
      }
    } catch (error) {
      console.error('Error loading billing stats:', error);
    }
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadStats();
    }
  }, [isLoadingTenant, tenantId, loadStats]);

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="back-to-dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              Facturación y Comisiones
            </h1>
            <p className="text-muted-foreground">{tenantName}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadStats}
          disabled={isLoading}
          data-testid="refresh-billing"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-500" />
              Cuotas Pendientes
            </CardDescription>
            <CardTitle className="text-2xl">
              {billingStats?.total_pending || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(billingStats?.amount_pending || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Cuotas Vencidas
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {billingStats?.total_overdue || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600">
              {formatCurrency(billingStats?.amount_overdue || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Cuotas Pagadas
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {billingStats?.total_paid || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-600">
              {formatCurrency(billingStats?.amount_paid || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-yellow-500" />
              Comisiones Pendientes
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {commissionsSummary?.count_pending || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-600">
              {formatCurrency(commissionsSummary?.total_pending || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger 
            value="invoices" 
            className="flex items-center gap-2"
            data-testid="tab-invoices"
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Cuotas</span>
          </TabsTrigger>
          <TabsTrigger 
            value="commissions" 
            className="flex items-center gap-2"
            data-testid="tab-commissions"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Comisiones</span>
          </TabsTrigger>
          <TabsTrigger 
            value="config" 
            className="flex items-center gap-2"
            data-testid="tab-config"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuración</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <InvoicesList onUpdate={loadStats} />
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <CommissionsPanel 
            summary={commissionsSummary} 
            onUpdate={loadStats} 
          />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <CommissionRatesConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
