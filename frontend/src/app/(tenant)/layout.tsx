'use client';

// =====================================================
// LAYOUT: Tenant Layout con Sidebar y Permisos
// Oculta secciones según permisos Y plan del tenant
// =====================================================

import { useState, useEffect } from 'react';
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
  ChevronLeft,
  Zap,
  MessageSquare,
  Sparkles,
  Calculator,
  Handshake,
  Lock,
  Crown,
  ClipboardList,
  Wallet,
  Coins,
  PanelLeftClose,
  PanelLeftOpen
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
  { title: 'Cartera', href: '/cartera', icon: Wallet, permissionKey: 'polizas' },
  { title: 'Control Comisiones', href: '/comisiones', icon: Coins, adminOnly: true },
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
  const [collapsed, setCollapsed] = useState(false);
  useTenantBranding();

  // Cargar estado colapsado desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // Guardar estado colapsado
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  // Verificar si tiene acceso premium
  const hasPremiumAccess = tenantPlan === 'premium' || tenantPlan === 'trial';

  // Mostrar loading solo en la carga inicial
  if (isLoading || loadingPermissions) {
    return <LoadingScreen />;
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
      return (
        <div
          key={item.href}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed',
            collapsed && !isMobile && 'justify-center px-2'
          )}
          title={collapsed && !isMobile ? item.title : undefined}
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span>{item.title}</span>}
          {(!collapsed || isMobile) && <Lock className="h-3 w-3 ml-auto" />}
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
            : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground',
          collapsed && !isMobile && 'justify-center px-2'
        )}
        title={collapsed && !isMobile ? item.title : undefined}
        data-testid={`nav-${item.title.toLowerCase()}`}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {(!collapsed || isMobile) && <span>{item.title}</span>}
        {(!collapsed || isMobile) && item.href === '/mensajes' && <UnreadMessagesBadge />}
        {(!collapsed || isMobile) && item.badge && (
          <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
        {(!collapsed || isMobile) && isActive && !item.badge && item.href !== '/mensajes' && <ChevronRight className="h-4 w-4 ml-auto" />}
      </Link>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed inset-y-0 left-0 z-30 bg-white border-r transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo / Tenant Name */}
        <div className={cn(
          'flex items-center h-16 border-b px-4 flex-shrink-0',
          collapsed ? 'justify-center' : 'gap-3'
        )}>
          <Building2 className="h-6 w-6 text-primary flex-shrink-0" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate">{tenantName || 'CRM'}</h2>
              {hasPremiumAccess && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Premium
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredNavItems.map((item) => renderNavItem(item, false))}
        </nav>

        {/* Toggle collapse button */}
        <div className="border-t px-3 py-2">
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors"
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            data-testid="toggle-sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5 flex-shrink-0 mx-auto" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5 flex-shrink-0" />
                <span>Colapsar</span>
              </>
            )}
          </button>
        </div>

        {/* User info + Logout */}
        <div className={cn(
          'border-t p-4 flex-shrink-0',
          collapsed && 'px-2'
        )}>
          {!collapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{userFullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          )}
          <div className={cn(
            'flex items-center',
            collapsed ? 'flex-col gap-2' : 'gap-2'
          )}>
            <NotificationBell />
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className={cn(
                'text-red-600 hover:text-red-700 hover:bg-red-50',
                collapsed ? 'w-10 h-10 p-0' : 'flex-1'
              )}
              title={collapsed ? 'Cerrar sesión' : undefined}
              data-testid="logout-button"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Salir</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b h-14 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          data-testid="mobile-menu-toggle"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-3 font-semibold text-sm">{tenantName || 'CRM'}</span>
        {hasPremiumAccess && (
          <Crown className="h-4 w-4 text-amber-500 ml-2" />
        )}
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            {/* Mobile sidebar header */}
            <div className="flex items-center justify-between h-14 border-b px-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                <h2 className="font-semibold text-sm">{tenantName || 'CRM'}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Mobile navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {filteredNavItems.map((item) => renderNavItem(item, true))}
            </nav>

            {/* Mobile user info */}
            <div className="border-t p-4">
              <div className="mb-3">
                <p className="text-sm font-medium">{userFullName}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                data-testid="mobile-logout-button"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        'h-screen flex flex-col overflow-hidden transition-all duration-300',
        collapsed ? 'md:ml-16' : 'md:ml-64'
      )}>
        {/* Spacer for mobile header */}
        <div className="h-14 md:hidden flex-shrink-0" />

        {/* Page Content */}
          <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
