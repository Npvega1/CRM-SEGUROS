'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
      try {
        const [clientRes, policyRes, pipelineRes] = await Promise.all([
          fetch('/api/clientes/stats'),
          fetch('/api/polizas/stats'),
          fetch('/api/pipeline/stats')
        ]);

        if (clientRes.ok) {
          const data = await clientRes.json();
          setClientStats({ total: data.total, thisMonth: data.thisMonth });
        }
        if (policyRes.ok) {
          const data = await policyRes.json();
          setPolicyStats({ total: data.total, active: data.active, totalPremium: data.totalPremium });
        }
        if (pipelineRes.ok) {
          const data = await pipelineRes.json();
          setPipelineStats({ 
            total_active: data.stats?.total_active || 0, 
            weighted_premium: data.stats?.weighted_premium || 0 
          });
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }
    if (!isLoading) {
      loadStats();
    }
  }, [isLoading]);

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
