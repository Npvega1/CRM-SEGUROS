'use client';

// =====================================================
// LAYOUT: Tenant Layout con Sidebar y Permisos
// Oculta secciones según permisos Y plan del tenant
// =====================================================

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/lib/context/TenantContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { LoadingScreen } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import {
  LayoutDashboard,
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Receipt,
  LogOut,
  Menu,
  Settings,
  X,
  Building2,
  ChevronRight,
  Zap,
  MessageSquare,
  Sparkles,
  Calculator,
  Handshake,
  Lock,
  Crown,
  ClipboardList
} from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UnreadMessagesBadge } from '@/components/ui/UnreadMessagesBadge';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  permissionKey?: 'clientes' | 'polizas' | 'pipeline' | 'siniestros' | 'facturacion' | 'reportes' | 'mensajes' | 'automatizaciones' | 'comparativos' | 'cotizador';
  adminOnly?: boolean;
  alwaysShow?: boolean;
  premiumOnly?: boolean;
}

// Orden actualizado de navegación
const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, alwaysShow: true },
  { title: 'Reportes', href: '/reports', icon: BarChart3, permissionKey: 'reportes' },
  { title: 'Clientes', href: '/clientes', icon: Users, permissionKey: 'clientes' },
  { title: 'Aliados', href: '/aliados', icon: Handshake, adminOnly: true, badge: 'Nuevo' },
  { title: 'Pólizas', href: '/polizas', icon: FileText, permissionKey: 'polizas' },
  { title: 'Remisiones', href: '/remisiones', icon: ClipboardList, permissionKey: 'polizas' },
  { title: 'Siniestros', href: '/siniestros', icon: AlertTriangle, permissionKey: 'siniestros' },
  { title: 'Facturación', href: '/billing', icon: Receipt, permissionKey: 'facturacion' },
  { title: 'Pipeline', href: '/pipeline', icon: TrendingUp, permissionKey: 'pipeline', premiumOnly: true },
  { title: 'Mensajes', href: '/mensajes', icon: MessageSquare, permissionKey: 'mensajes', premiumOnly: true },
  { title: 'Cotizador', href: '/cotizador', icon: Calculator, permissionKey: 'cotizador', badge: 'Pro', premiumOnly: true },
  { title: 'Cotizaciones IA', href: '/ai-compare', icon: Sparkles, permissionKey: 'comparativos', premiumOnly: true },
  { title: 'Automatizaciones', href: '/automations', icon: Zap, permissionKey: 'automatizaciones', premiumOnly: true },
  { title: 'Configuración', href: '/settings', icon: Settings, adminOnly: true },
];

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { tenantName, userFullName, role, isLoading, signOut, tenantPlan } = useTenant();
  const { canView, isAdmin, loading: loadingPermissions } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useTenantBranding();

  // Verificar si tiene acceso premium
  const hasPremiumAccess = tenantPlan === 'premium' || tenantPlan === 'trial';

  // Mostrar loading solo en la carga inicial
  if (isLoading || loadingPermissions) {
    return <LoadingScreen message="Cargando..." />;
  }

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  // Filtrar items de navegación según permisos Y plan
  const filteredNavItems = navItems.filter((item) => {
    // Si siempre se muestra (Dashboard)
    if (item.alwaysShow) return true;
    
    // Si es solo para admin
    if (item.adminOnly) return isAdmin;
    
    // Si tiene clave de permiso, verificar si puede ver
    if (item.permissionKey) {
      return isAdmin || canView(item.permissionKey);
    }
    
    return true;
  });

  // Renderizar item de navegación (con lógica de premium)
  const renderNavItem = (item: NavItem, isMobile: boolean = false) => {
    const isActive = isActiveRoute(item.href);
    const isLocked = item.premiumOnly && !hasPremiumAccess;

    if (isLocked) {
      // Mostrar item bloqueado
      return (
        <div
          key={item.href}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed opacity-50 text-muted-foreground"
          title="Módulo Premium - Actualiza tu plan"
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          <span>{item.title}</span>
          <Lock className="ml-auto h-4 w-4 text-amber-500" />
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={isMobile ? () => setSidebarOpen(false) : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
        )}
        data-testid={`nav-${item.title.toLowerCase()}`}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        <span>{item.title}</span>
        {item.href === '/mensajes' && <UnreadMessagesBadge className="ml-auto" />}
        {item.badge && (
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
        {isActive && !item.badge && item.href !== '/mensajes' && <ChevronRight className="ml-auto h-4 w-4" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{tenantName || 'CRM Seguros'}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground truncate">
                {role === 'admin' ? 'Administrador' : 'Agente'}
              </p>
              {hasPremiumAccess && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  <Crown className="h-3 w-3" />
                  Pro
                </span>
              )}
            </div>
          </div>
          <NotificationBell />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => renderNavItem(item, false))}
        </nav>

        {/* Upgrade Banner (solo para plan básico) */}
        {!hasPremiumAccess && (
          <div className="mx-3 mb-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Plan Básico</span>
            </div>
            <p className="text-xs text-amber-700 mb-2">
              Desbloquea Pipeline, Cotizador IA y más.
            </p>
            <Button 
              size="sm" 
              className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs"
              onClick={() => window.open('mailto:contact@integratech.com.co?subject=Upgrade a Premium', '_blank')}
            >
              Actualizar a Premium
            </Button>
          </div>
        )}

        {/* User Section */}
        <div className="border-t px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-600">
                {userFullName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userFullName || 'Usuario'}</p>
              <p className="text-xs text-muted-foreground truncate">{role === 'admin' ? 'Administrador' : 'Agente'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2 text-muted-foreground hover:text-foreground"
            onClick={signOut}
            data-testid="sidebar-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-toggle"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">{tenantName || 'CRM'}</span>
              {hasPremiumAccess && (
                <Crown className="h-4 w-4 text-amber-500" />
              )}
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">{tenantName || 'CRM Seguros'}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => renderNavItem(item, true))}
        </nav>

        {/* Mobile Upgrade Banner */}
        {!hasPremiumAccess && (
          <div className="mx-3 mb-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Plan Básico</span>
            </div>
            <p className="text-xs text-amber-700">
              Contacta para actualizar a Premium
            </p>
          </div>
        )}

        {/* Mobile User Section */}
        <div className="border-t px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-600">
                {userFullName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userFullName || 'Usuario'}</p>
              <p className="text-xs text-muted-foreground truncate">{role === 'admin' ? 'Administrador' : 'Agente'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64">
        {/* Spacer for mobile header */}
        <div className="lg:hidden h-14" />

        {/* Page Content */}
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
