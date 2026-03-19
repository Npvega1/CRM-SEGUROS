'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBrowserClient } from '@/lib/supabase/client';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  Plus,
  ArrowRight,
  Building2,
  Shield,
  LogOut
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { 
    tenantName, 
    tenantId,
    userFullName, 
    role, 
    isLoading, 
    signOut 
  } = useTenant();

  const [clientStats, setClientStats] = useState<{ total: number; thisMonth: number } | null>(null);
  const [policyStats, setPolicyStats] = useState<{ total: number; active: number; totalPremium: number } | null>(null);
  const [pipelineStats, setPipelineStats] = useState<{ total_active: number; weighted_premium: number } | null>(null);

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
        
        const thisMonthClients = clients?.filter(c => new Date(c.created_at) >= thisMonth).length || 0;
        setClientStats({ total: clientCount || 0, thisMonth: thisMonthClients });
        
        // Load policy stats
        const { data: policies } = await supabase
          .from('policies')
          .select('status, premium')
          .eq('tenant_id', tenantId);
        
        const activePolicies = policies?.filter(p => p.status === 'active').length || 0;
        const totalPremium = policies?.reduce((sum, p) => sum + (p.premium || 0), 0) || 0;
        setPolicyStats({ total: policies?.length || 0, active: activePolicies, totalPremium });
        
        // Load pipeline stats
        const { data: opportunities } = await supabase
          .from('opportunities')
          .select('status, estimated_premium, probability')
          .eq('tenant_id', tenantId);
        
        const activeOpps = opportunities?.filter(o => o.status === 'active').length || 0;
        const weightedPremium = opportunities
          ?.filter(o => o.status === 'active')
          .reduce((sum, o) => sum + ((o.estimated_premium || 0) * (o.probability || 0) / 100), 0) || 0;
        setPipelineStats({ total_active: activeOpps, weighted_premium: weightedPremium });
        
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }
    if (!isLoading && tenantId) {
      loadStats();
    }
  }, [isLoading, tenantId]);

  if (isLoading) {
    return <LoadingScreen message="Cargando dashboard..." />;
  }

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
      title: 'Clientes Activos',
      value: clientStats?.total?.toString() || '0',
      change: clientStats?.thisMonth ? `+${clientStats.thisMonth} este mes` : '+0 este mes',
      icon: Users,
      href: '/clientes'
    },
    {
      title: 'Pólizas Activas',
      value: policyStats?.active?.toString() || '0',
      change: `${policyStats?.total || 0} total`,
      icon: FileText,
      href: '/polizas'
    },
    {
      title: 'Pipeline de Ventas',
      value: pipelineStats?.total_active?.toString() || '0',
      change: formatPremium(pipelineStats?.weighted_premium || 0),
      icon: TrendingUp,
      href: '/pipeline'
    },
    {
      title: 'Siniestros Abiertos',
      value: '0',
      change: 'Próximamente',
      icon: AlertTriangle,
      href: '/siniestros'
    },
  ];

  const quickActions = [
    { title: 'Nuevo Cliente', icon: Users, href: '/clientes/nuevo' },
    { title: 'Nueva Póliza', icon: FileText, href: '/polizas/nuevo' },
    { title: 'Nueva Oportunidad', icon: TrendingUp, href: '/pipeline' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tenantName}</h1>
            <p className="text-muted-foreground">
              Bienvenido, {userFullName} ({role})
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Link key={index} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`stat-card-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Operaciones frecuentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href}>
                <Button variant="outline" className="gap-2">
                  <action.icon className="h-4 w-4" />
                  {action.title}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/clientes">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Clientes
              </CardTitle>
              <CardDescription>
                Gestiona tu cartera de clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="p-0">
                Ver clientes <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/polizas">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Pólizas
              </CardTitle>
              <CardDescription>
                Administra las pólizas de seguros
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="p-0">
                Ver pólizas <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/pipeline">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                Pipeline
              </CardTitle>
              <CardDescription>
                Oportunidades de venta y forecast
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="p-0">
                Ver pipeline <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
