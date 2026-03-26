'use client';

// =====================================================
// LAYOUT: Tenant Layout con Sidebar y Permisos
// Oculta secciones según los permisos del usuario
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
  Handshake
} from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UnreadMessagesBadge } from '@/components/ui/UnreadMessagesBadge';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  permissionKey?: 'clientes' | 'polizas' | 'pipeline' | 'siniestros' | 'facturacion' | 'reportes' | 'mensajes' | 'automatizaciones' | 'comparativos' | 'cotizador' | 'aliados';
  adminOnly?: boolean;
  alwaysShow?: boolean;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, alwaysShow: true },
  { title: 'Clientes', href: '/clientes', icon: Users, permissionKey: 'clientes' },
  { title: 'Pólizas', href: '/polizas', icon: FileText, permissionKey: 'polizas' },
  { title: 'Pipeline', href: '/pipeline', icon: TrendingUp, permissionKey: 'pipeline' },
  { title: 'Siniestros', href: '/siniestros', icon: AlertTriangle, permissionKey: 'siniestros' },
  { title: 'Cotizador', href: '/cotizador', icon: Calculator, permissionKey: 'cotizador', badge: 'Nuevo' },
  { title: 'Cotizaciones IA', href: '/ai-compare', icon: Sparkles, permissionKey: 'comparativos' },
  { title: 'Mensajes', href: '/mensajes', icon: MessageSquare, permissionKey: 'mensajes' },
  { title: 'Aliados', href: '/aliados', icon: Handshake, adminOnly: true, badge: 'Nuevo' },
  { title: 'Facturación', href: '/billing', icon: Receipt, permissionKey: 'facturacion' },
  { title: 'Automatizaciones', href: '/automations', icon: Zap, permissionKey: 'automatizaciones' },
  { title: 'Reportes', href: '/reports', icon: BarChart3, permissionKey: 'reportes' },
  { title: 'Configuración', href: '/settings', icon: Settings, adminOnly: true },
];

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { tenantName, userFullName, role, isLoading, signOut } = useTenant();
  const { canView, isAdmin, loading: loadingPermissions } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useTenantBranding();

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

  // Filtrar items de navegación según permisos
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
            <p className="text-xs text-muted-foreground truncate">{role === 'admin' ? 'Administrador' : 'Agente'}</p>
          </div>
          <NotificationBell />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
          })}
        </nav>

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
          {filteredNavItems.map((item) => {
            const isActive = isActiveRoute(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
                {item.href === '/mensajes' && <UnreadMessagesBadge className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

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
