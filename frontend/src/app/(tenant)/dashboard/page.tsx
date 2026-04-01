'use client';

// =====================================================
// PÁGINA: Dashboard
// /dashboard
// =====================================================

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBrowserClient } from '@/lib/supabase/client';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Handshake,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { tenantName, tenantId, tenantSlug, userFullName, isLoading } = useTenant();

  const [clientStats, setClientStats] = useState<{ total: number; thisMonth: number } | null>(null);
  const [policyStats, setPolicyStats] = useState<{ total: number; active: number; totalPremium: number } | null>(null);
  const [pipelineStats, setPipelineStats] = useState<{ total_active: number; weighted_premium: number } | null>(null);
  const [claimStats, setClaimStats] = useState<{ total: number; open: number } | null>(null);

  useEffect(() => {
    async function loadStats() {
      if (!tenantId) return;
      
      try {
        const supabase = getBrowserClient();
        
        // Load client stats
        const { data: clients, count: clientCount } = await supabase
          .from('clients')
          .select('created_at', { count: 'exact' })
          .eq('tenant_id', tenantId);
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        
        const clientsTyped = clients as Array<{ created_at: string }> | null;
        const thisMonthClients = clientsTyped?.filter(c => new Date(c.created_at) >= thisMonth).length || 0;
        setClientStats({ total: clientCount || 0, thisMonth: thisMonthClients });
        
        // Load policy stats
        const { data: policies } = await supabase
          .from('policies')
          .select('status, premium')
          .eq('tenant_id', tenantId);
        
        const policiesTyped = policies as Array<{ status: string; premium: number }> | null;
        const activePolicies = policiesTyped?.filter(p => p.status === 'activa').length || 0;
        const totalPremium = policiesTyped?.reduce((sum, p) => sum + (p.premium || 0), 0) || 0;
        setPolicyStats({ total: policiesTyped?.length || 0, active: activePolicies, totalPremium });
        
        // Load pipeline stats
        const { data: opportunities } = await supabase
          .from('opportunities')
          .select('status, estimated_premium, probability')
          .eq('tenant_id', tenantId);
        
        const oppsTyped = opportunities as Array<{ status: string; estimated_premium: number; probability: number }> | null;
        const activeOpps = oppsTyped?.filter(o => o.status === 'active').length || 0;
        const weightedPremium = oppsTyped
          ?.filter(o => o.status === 'active')
          .reduce((sum, o) => sum + ((o.estimated_premium || 0) * (o.probability || 0) / 100), 0) || 0;
        setPipelineStats({ total_active: activeOpps, weighted_premium: weightedPremium });

        // Load claim stats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: claims } = await (supabase as any)
          .from('claims')
          .select('status')
          .eq('tenant_id', tenantId);
        
        const claimsTyped = claims as Array<{ status: string }> | null;
        const openClaims = claimsTyped?.filter(c => 
          !['resolved', 'closed'].includes(c.status)
        ).length || 0;
        setClaimStats({ total: claimsTyped?.length || 0, open: openClaims });
        
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }
    if (!isLoading && tenantId) {
      loadStats();
    }
  }, [isLoading, tenantId]);

  const formatPremium = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const stats = [
    {
      title: 'Clientes',
      value: clientStats?.total?.toString() || '0',
      change: clientStats?.thisMonth ? `+${clientStats.thisMonth} este mes` : null,
      changeType: 'positive' as const,
      icon: Users,
      href: '/clientes',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Pólizas Activas',
      value: policyStats?.active?.toString() || '0',
      change: policyStats ? formatPremium(policyStats.totalPremium) : null,
      changeType: 'neutral' as const,
      icon: FileText,
      href: '/polizas',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Oportunidades',
      value: pipelineStats?.total_active?.toString() || '0',
      change: pipelineStats ? formatPremium(pipelineStats.weighted_premium) : null,
      changeType: 'positive' as const,
      icon: TrendingUp,
      href: '/pipeline',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Siniestros Abiertos',
      value: claimStats?.open?.toString() || '0',
      change: claimStats?.total ? `${claimStats.total} total` : null,
      changeType: claimStats?.open && claimStats.open > 0 ? 'negative' as const : 'neutral' as const,
      icon: AlertTriangle,
      href: '/siniestros',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
  ];

  // Build portal URLs
  const portalBaseUrl = tenantSlug ? `/${tenantSlug}` : '';

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">¡Hola, {userFullName?.split(' ')[0] || 'Usuario'}!</h1>
          <p className="text-muted-foreground">
            Bienvenido al dashboard de {tenantName}
          </p>
        </div>
        {tenantSlug && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${portalBaseUrl}/aliado`, '_blank')}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
              data-testid="portal-aliados-btn"
            >
              <Handshake className="w-4 h-4 mr-1.5" />
              Portal Aliados
              <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${portalBaseUrl}/login`, '_blank')}
              className="border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
              data-testid="portal-clientes-btn"
            >
              <Users className="w-4 h-4 mr-1.5" />
              Portal Clientes
              <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
            </Button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Link key={index} href={stat.href}>
            <Card className="hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer" data-testid={`stat-card-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                {stat.change && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${
                    stat.changeType === 'positive' ? 'text-green-600' :
                    stat.changeType === 'negative' ? 'text-red-600' :
                    'text-muted-foreground'
                  }`}>
                    {stat.changeType === 'positive' && <ArrowUpRight className="h-3 w-3" />}
                    {stat.changeType === 'negative' && <ArrowDownRight className="h-3 w-3" />}
                    {stat.change}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen del Mes</CardTitle>
            <CardDescription>Actividad reciente de tu agencia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Nuevos clientes</span>
              <span className="font-semibold">{clientStats?.thisMonth || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pólizas totales</span>
              <span className="font-semibold">{policyStats?.total || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Prima total activa</span>
              <span className="font-semibold">{formatPremium(policyStats?.totalPremium || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pipeline ponderado</span>
              <span className="font-semibold">{formatPremium(pipelineStats?.weighted_premium || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accesos Rápidos</CardTitle>
            <CardDescription>Acciones frecuentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link 
                href="/clientes/nuevo"
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
              >
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Nuevo Cliente</span>
              </Link>
              <Link 
                href="/polizas/nueva"
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
              >
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Nueva Póliza</span>
              </Link>
              <Link 
                href="/pipeline"
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
              >
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Ver Pipeline</span>
              </Link>
              <Link 
                href="/siniestros"
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
              >
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Ver Siniestros</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
