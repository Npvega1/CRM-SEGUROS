'use client';

// =====================================================
// LAYOUT: Tenant Layout con Menú Horizontal y Permisos
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
  Home,
  Bell
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

interface NavGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  items: NavItem[];
}

// Grupos de navegación con estructura jerárquica
const navGroups: NavGroup[] = [
  {
    id: 'inicio',
    title: 'Inicio',
    icon: Home,
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, alwaysShow: true },
      { title: 'Reportes', href: '/reports', icon: BarChart3, permissionKey: 'reportes' },
    ]
  },
  {
    id: 'contactos',
    title: 'Contactos',
    icon: Users,
    items: [
      { title: 'Clientes', href: '/clientes', icon: Users, permissionKey: 'clientes' },
      { title: 'Aliados', href: '/aliados', icon: Handshake, adminOnly: true, badge: 'Nuevo' },
      { title: 'Mensajes', href: '/mensajes', icon: MessageSquare, permissionKey: 'mensajes', premiumOnly: true },
    ]
  },
  {
    id: 'produccion',
    title: 'Producción',
    icon: FileText,
    items: [
      { title: 'Pólizas', href: '/polizas', icon: FileText, permissionKey: 'polizas' },
      { title: 'Remisiones', href: '/remisiones', icon: ClipboardList, permissionKey: 'polizas' },
      { title: 'Cartera', href: '/cartera', icon: Wallet, permissionKey: 'polizas' },
      { title: 'Facturación', href: '/billing', icon: Receipt, permissionKey: 'facturacion' },
      { title: 'Control Comisiones', href: '/comisiones', icon: Coins, adminOnly: true },
    ]
  },
  {
    id: 'ventas',
    title: 'Ventas',
    icon: TrendingUp,
    items: [
      { title: 'Pipeline', href: '/pipeline', icon: TrendingUp, permissionKey: 'pipeline', premiumOnly: true },
      { title: 'Cotizador', href: '/cotizador', icon: Calculator, permissionKey: 'cotizador', badge: 'Pro', premiumOnly: true },
      { title: 'Cotizaciones IA', href: '/ai-compare', icon: Sparkles, permissionKey: 'comparativos', premiumOnly: true },
    ]
  },
  {
    id: 'siniestros',
    title: 'Siniestros',
    icon: AlertTriangle,
    items: [
      { title: 'Siniestros', href: '/siniestros', icon: AlertTriangle, permissionKey: 'siniestros' },
    ]
  },
  {
    id: 'sistema',
    title: 'Sistema',
    icon: Settings,
    items: [
      { title: 'Automatizaciones', href: '/automations', icon: Zap, permissionKey: 'automatizaciones', premiumOnly: true },
      { title: 'Configuración', href: '/settings', icon: Settings, adminOnly: true },
    ]
  },
];

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { tenantName, userFullName, role, isLoading, signOut, tenantPlan } = useTenant();
  const { canView, isAdmin, loading: loadingPermissions } = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('inicio');
  useTenantBranding();

  // Determinar grupo activo basado en la ruta actual
  useEffect(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(item.href + '/')) {
          setActiveGroup(group.id);
          return;
        }
      }
    }
  }, [pathname]);

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

  // Filtrar items según permisos
  const canShowItem = (item: NavItem): boolean => {
    if (item.alwaysShow) return true;
    if (item.adminOnly) return isAdmin;
    if (item.permissionKey) {
      return isAdmin || canView(item.permissionKey);
    }
    return true;
  };

  // Filtrar grupos que tengan al menos un item visible
  const visibleGroups = navGroups.filter(group => 
    group.items.some(item => canShowItem(item))
  );

  // Obtener items del grupo activo
  const activeGroupData = navGroups.find(g => g.id === activeGroup);
  const activeGroupItems = activeGroupData?.items.filter(item => canShowItem(item)) || [];

  // Obtener iniciales del usuario
  const getUserInitials = () => {
    if (userFullName) {
      return userFullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return tenantName?.slice(0, 2).toUpperCase() || 'US';
  };

  // Renderizar item del submenu
  const renderSubmenuItem = (item: NavItem, isMobile: boolean = false) => {
    const isActive = isActiveRoute(item.href);
    const isLocked = item.premiumOnly && !hasPremiumAccess;

    if (isLocked) {
      return (
        <div
          key={item.href}
          className="submenu-item submenu-locked"
          title="Requiere plan Premium"
        >
          <item.icon className="w-3.5 h-3.5" />
          <span>{item.title}</span>
          <Lock className="w-3 h-3 ml-1 text-slate-400" />
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
        className={cn(
          'submenu-item',
          isActive && 'sub-active'
        )}
        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <item.icon className="w-3.5 h-3.5" />
        <span>{item.title}</span>
        {item.href === '/mensajes' && <UnreadMessagesBadge />}
        {item.badge && (
          <span className="submenu-badge">{item.badge}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#eef1f8]">
      {/* Estilos del menú horizontal */}
      <style jsx global>{`
        /* TOP BAR */
        .top-bar {
          background: #fff;
          border-bottom: 1px solid #e4e7ef;
          display: flex;
          align-items: center;
          height: 54px;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .logo-area {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 180px;
          margin-right: 24px;
        }
        .logo-icon {
          width: 32px;
          height: 32px;
          background: var(--primary, #2563eb);
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .logo-icon svg {
          width: 17px;
          height: 17px;
          color: white;
        }
        .logo-text {
          font-size: 13.5px;
          font-weight: 600;
          color: #1a1f36;
          line-height: 1.2;
        }
        .logo-sub {
          font-size: 10.5px;
          color: #94a3b8;
          font-weight: 400;
        }
        .pro-badge {
          background: #fef3c7;
          color: #92400e;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          border: 1px solid #fde68a;
          margin-left: 4px;
          white-space: nowrap;
        }

        /* NAV TABS */
        .nav-tabs {
          display: flex;
          align-items: stretch;
          flex: 1;
          height: 100%;
          gap: 2px;
        }
        .nav-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 18px;
          cursor: pointer;
          font-size: 13.5px;
          font-weight: 500;
          color: #64748b;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
          white-space: nowrap;
          background: transparent;
          border-top: none;
          border-left: none;
          border-right: none;
        }
        .nav-tab:hover {
          color: #1e40af;
          background: #f5f8ff;
        }
        .nav-tab.active {
          color: #2563eb;
          border-bottom: 2px solid #2563eb;
          background: #f8faff;
        }
        .nav-tab svg {
          opacity: 0.65;
          flex-shrink: 0;
        }
        .nav-tab.active svg {
          opacity: 1;
        }

        .top-right {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: auto;
        }
        .notif-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #f1f4fb;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .notif-btn:hover {
          background: #dce8ff;
        }
        .avatar-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--primary, #2563eb);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s;
        }
        .avatar-btn:hover {
          opacity: 0.9;
        }

        /* SUBMENU */
        .submenu {
          background: #fff;
          border-bottom: 1px solid #e4e7ef;
          padding: 0 24px;
          display: flex;
          gap: 4px;
          align-items: center;
          height: 40px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          position: sticky;
          top: 54px;
          z-index: 90;
        }
        .submenu-item {
          font-size: 12.5px;
          color: #64748b;
          padding: 5px 13px;
          border-radius: 7px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.13s;
          display: flex;
          align-items: center;
          gap: 5px;
          text-decoration: none;
        }
        .submenu-item:hover {
          background: #eff6ff;
          color: #2563eb;
        }
        .submenu-item.sub-active {
          background: #eff6ff;
          color: #2563eb;
        }
        .submenu-item.submenu-locked {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .submenu-badge {
          font-size: 9px;
          background: #fef3c7;
          color: #92400e;
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 600;
        }

        /* CONTENT */
        .main-content {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* MOBILE */
        @media (max-width: 1024px) {
          .nav-tabs {
            display: none;
          }
          .logo-area {
            min-width: auto;
            margin-right: 0;
          }
          .mobile-menu-btn {
            display: flex;
          }
        }
        @media (min-width: 1025px) {
          .mobile-menu-btn {
            display: none;
          }
        }

        /* Mobile Menu Overlay */
        .mobile-menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 200;
        }
        .mobile-menu-panel {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          background: #fff;
          z-index: 201;
          overflow-y: auto;
          box-shadow: 4px 0 20px rgba(0,0,0,0.1);
        }
        .mobile-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #e4e7ef;
        }
        .mobile-menu-content {
          padding: 16px;
        }
        .mobile-group-title {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 16px 12px 8px;
        }
        .mobile-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          color: #64748b;
          text-decoration: none;
          transition: all 0.15s;
        }
        .mobile-nav-item:hover {
          background: #f5f8ff;
          color: #2563eb;
        }
        .mobile-nav-item.active {
          background: #eff6ff;
          color: #2563eb;
        }
        .mobile-nav-item.locked {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {/* TOP BAR */}
      <header className="top-bar">
        <div className="logo-area">
          <div className="logo-icon">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="logo-text">{tenantName || 'CRM'}</div>
            <div className="logo-sub">{role === 'admin' ? 'Administrador' : role}</div>
          </div>
          {hasPremiumAccess && (
            <span className="pro-badge">
              <Crown className="w-3 h-3 inline mr-1" />
              Pro
            </span>
          )}
        </div>

        {/* NAV TABS - Desktop */}
        <nav className="nav-tabs">
          {visibleGroups.map((group) => (
            <button
              key={group.id}
              className={cn('nav-tab', activeGroup === group.id && 'active')}
              onClick={() => setActiveGroup(group.id)}
              data-testid={`nav-group-${group.id}`}
            >
              <group.icon className="w-4 h-4" />
              {group.title}
            </button>
          ))}
        </nav>

        <div className="top-right">
          {/* Mobile menu button */}
          <button
            className="mobile-menu-btn notif-btn lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            data-testid="mobile-menu-toggle"
          >
            <Menu className="w-4 h-4 text-slate-500" />
          </button>

          <NotificationBell />
          
          <button 
            className="avatar-btn" 
            onClick={() => signOut()}
            title="Cerrar sesión"
            data-testid="user-avatar"
          >
            {getUserInitials()}
          </button>
        </div>
      </header>

      {/* SUBMENU - Desktop */}
      <div className="submenu hidden lg:flex">
        {activeGroupItems.map((item) => renderSubmenuItem(item))}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          <div 
            className="mobile-menu-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="mobile-menu-panel">
            <div className="mobile-menu-header">
              <div className="flex items-center gap-2">
                <div className="logo-icon">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm">{tenantName || 'CRM'}</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="mobile-menu-content">
              {visibleGroups.map((group) => (
                <div key={group.id}>
                  <div className="mobile-group-title">{group.title}</div>
                  {group.items.filter(item => canShowItem(item)).map((item) => {
                    const isActive = isActiveRoute(item.href);
                    const isLocked = item.premiumOnly && !hasPremiumAccess;

                    if (isLocked) {
                      return (
                        <div
                          key={item.href}
                          className="mobile-nav-item locked"
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                          <Lock className="w-3 h-3 ml-auto" />
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn('mobile-nav-item', isActive && 'active')}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {item.href === '/mensajes' && <UnreadMessagesBadge />}
                        {item.badge && (
                          <span className="submenu-badge ml-auto">{item.badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
              
              {/* Logout en mobile */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="mobile-nav-item w-full text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
