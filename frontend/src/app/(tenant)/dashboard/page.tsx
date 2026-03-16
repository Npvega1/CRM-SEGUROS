'use client';

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

  if (isLoading) {
    return <LoadingScreen message="Cargando dashboard..." />;
  }

  // Stats de ejemplo (se conectarán con datos reales en módulos posteriores)
  const stats = [
    {
      title: 'Clientes Activos',
      value: '0',
      change: '+0%',
      icon: Users,
      href: '/clientes'
    },
    {
      title: 'Pólizas Vigentes',
      value: '0',
      change: '+0%',
      icon: FileText,
      href: '/polizas'
    },
    {
      title: 'Pipeline de Ventas',
      value: '$0',
      change: '+0%',
      icon: TrendingUp,
      href: '/pipeline'
    },
    {
      title: 'Siniestros Abiertos',
      value: '0',
      change: '0%',
      icon: AlertTriangle,
      href: '/siniestros'
    }
  ];

  const quickActions = [
    { label: 'Nuevo Cliente', icon: Users, href: '/clientes/nuevo' },
    { label: 'Nueva Póliza', icon: FileText, href: '/polizas/nueva' },
    { label: 'Nueva Oportunidad', icon: TrendingUp, href: '/pipeline/nuevo' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Sistema de gestión</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{userFullName || 'Usuario'}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={signOut}
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">
            ¡Hola, {userFullName?.split(' ')[0] || 'Usuario'}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Aquí tienes un resumen de tu agencia
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                      <p className="text-xs text-green-600 mt-1">{stat.change} vs mes anterior</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
              <CardDescription>Crea registros nuevos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Link key={action.label} href={action.href}>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-2"
                    data-testid={`quick-action-${action.label.toLowerCase().replace(' ', '-')}`}
                  >
                    <Plus className="w-4 h-4" />
                    {action.label}
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Actividad Reciente</CardTitle>
              <CardDescription>Últimas acciones en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay actividad reciente</p>
                <p className="text-sm">Las acciones aparecerán aquí</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup Progress (para nuevos tenants) */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Configuración Inicial</CardTitle>
            <CardDescription>Completa estos pasos para comenzar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-medium text-sm">
                  ✓
                </div>
                <div className="flex-1">
                  <p className="font-medium">Crear cuenta</p>
                  <p className="text-sm text-muted-foreground">Tu agencia está registrada</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium">Agregar primer cliente</p>
                  <p className="text-sm text-muted-foreground">Comienza a gestionar tus clientes</p>
                </div>
                <Link href="/clientes/nuevo">
                  <Button size="sm" data-testid="add-first-client-button">
                    Agregar
                  </Button>
                </Link>
              </div>
              
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-sm">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium">Invitar equipo</p>
                  <p className="text-sm text-muted-foreground">Agrega agentes a tu equipo</p>
                </div>
                <Link href="/configuracion/equipo">
                  <Button size="sm" variant="outline" data-testid="invite-team-button">
                    Invitar
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
