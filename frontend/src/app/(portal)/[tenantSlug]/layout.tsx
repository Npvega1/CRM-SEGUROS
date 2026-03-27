'use client';

// =====================================================
// LAYOUT: Portal del Cliente (White-Label)
// Módulo 07: Portal del Cliente
// Inyecta branding dinámico basado en tenant_settings
// NOTA: Excluye rutas de /aliado que tienen su propio layout
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { PortalProvider, usePortal } from '@/lib/context/PortalContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { TenantSettings } from '@/lib/validations/portal';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Receipt,
  MessageCircle,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
  Bell
} from 'lucide-react';

// =====================================================
// TIPOS
// =====================================================

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

// =====================================================
// COMPONENTE: PortalNavigation
// =====================================================

function PortalNavigation() {
  const pathname = usePathname();
  const params = useParams();
  const tenantSlug = params?.tenantSlug as string;
  const { client, summary, signOut, settings } = usePortal();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems: NavItem[] = useMemo(() => [
    { 
      title: 'Inicio', 
      href: `/${tenantSlug}/dashboard`, 
      icon: LayoutDashboard 
    },
    { 
      title: 'Mis Pólizas', 
      href: `/${tenantSlug}/policies`, 
      icon: FileText,
      badge: summary?.active_policies_count || undefined
    },
    { 
      title: 'Siniestros', 
      href: `/${tenantSlug}/claims`, 
      icon: AlertTriangle,
      badge: summary?.active_claims_count || undefined
    },
    { 
      title: 'Estado de Cuenta', 
      href: `/${tenantSlug}/account`, 
      icon: Receipt,
      badge: summary?.pending_invoices_count || undefined
    },
    { 
      title: 'Chat', 
      href: `/${tenantSlug}/chat`, 
      icon: MessageCircle,
      badge: summary?.unread_messages_count || undefined
    },
  ], [tenantSlug, summary]);

  const isActiveRoute = (href: string) => {
    const currentPath = pathname;
    if (href.endsWith('/dashboard')) {
      return currentPath.endsWith('/dashboard');
    }
    return currentPath.startsWith(href);
  };

  const logoUrl = settings?.logo_url;
  const tenantName = client.tenant_name || 'Portal de Cliente';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r portal-sidebar">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={tenantName} 
              className="h-9 w-auto max-w-[140px] object-contain"
              data-testid="portal-logo"
            />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          )}
          {!logoUrl && (
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{tenantName}</p>
              <p className="text-xs text-muted-foreground">Portal del Cliente</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
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
                data-testid={`portal-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.title}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {client.client_name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{client.client_name || 'Cliente'}</p>
              <p className="text-xs text-muted-foreground truncate">{client.client_email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2 text-muted-foreground hover:text-foreground"
            onClick={signOut}
            data-testid="portal-logout"
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
              data-testid="portal-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={tenantName} 
                className="h-8 w-auto max-w-[100px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">{tenantName}</span>
              </div>
            )}
          </div>
          {summary?.unread_messages_count && summary.unread_messages_count > 0 && (
            <Link href={`/${tenantSlug}/chat`}>
              <div className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {summary.unread_messages_count}
                </span>
              </div>
            </Link>
          )}
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
        <div className="flex items-center justify-between px-4 py-4 border-b">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={tenantName} 
              className="h-8 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">{tenantName}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
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
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {client.client_name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{client.client_name}</p>
              <p className="text-xs text-muted-foreground truncate">{client.client_email}</p>
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
    </>
  );
}

// =====================================================
// COMPONENTE: PortalContent
// =====================================================

function PortalContent({ children }: { children: React.ReactNode }) {
  const { isLoading, error, client } = usePortal();
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug as string;

  // Redirigir a login si no hay cliente
  useEffect(() => {
    if (!isLoading && !client.client_id && !error) {
      router.push(`/${tenantSlug}/login`);
    }
  }, [isLoading, client.client_id, error, router, tenantSlug]);

  if (isLoading) {
    return <LoadingScreen message="Cargando tu portal..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso no autorizado
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button 
            onClick={() => router.push(`/${tenantSlug}/login`)}
            data-testid="portal-error-login-btn"
          >
            Ir a Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  if (!client.client_id) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <PortalNavigation />
      <main className="flex-1 lg:pl-64">
        <div className="lg:hidden h-14" />
        <div className="min-h-screen p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// =====================================================
// COMPONENTE: StyleInjector
// =====================================================

function StyleInjector({ settings }: { settings: TenantSettings | null }) {
  useEffect(() => {
    if (!settings) return;

    const root = document.documentElement;
    
    if (settings.primary_color) {
      root.style.setProperty('--portal-primary', settings.primary_color);
      const hsl = hexToHSL(settings.primary_color);
      if (hsl) {
        root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      }
    }
    
    if (settings.secondary_color) {
      root.style.setProperty('--portal-secondary', settings.secondary_color);
    }

    if (settings.font_family && settings.font_family !== 'Inter') {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${settings.font_family.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      root.style.setProperty('--font-sans', `"${settings.font_family}", system-ui, sans-serif`);
    }

    if (settings.font_size_base) {
      root.style.setProperty('--portal-font-size-base', `${settings.font_size_base}px`);
    }

    return () => {
      root.style.removeProperty('--portal-primary');
      root.style.removeProperty('--portal-secondary');
      root.style.removeProperty('--font-sans');
      root.style.removeProperty('--portal-font-size-base');
    };
  }, [settings]);

  return null;
}

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// =====================================================
// COMPONENTE: TenantValidator
// =====================================================

function TenantValidator({ 
  children, 
  tenantSlug 
}: { 
  children: React.ReactNode; 
  tenantSlug: string;
}) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    async function validateTenant() {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('id, name, is_active')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (error || !tenant || !tenant.is_active) {
        setIsValid(false);
        return;
      }
      
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (settings) {
        setTenantSettings(settings as TenantSettings);
      }

      setIsValid(true);
    }

    validateTenant();
  }, [supabase, tenantSlug]);

  if (isValid === null) {
    return <LoadingScreen message="Verificando acceso..." />;
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Portal no encontrado
          </h1>
          <p className="text-gray-600">
            El portal que buscas no existe o no está disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <StyleInjector settings={tenantSettings} />
      {children}
    </>
  );
}

// =====================================================
// LAYOUT PRINCIPAL
// =====================================================

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const tenantSlug = params?.tenantSlug as string;

  // =====================================================
  // IMPORTANTE: Excluir rutas de /aliado
  // El portal de aliados tiene su propio layout
  // =====================================================
  const isAlliedRoute = pathname?.includes('/aliado');
  
  if (isAlliedRoute) {
    // Para rutas de aliados, solo renderizar children
    // El layout de aliados se encargará de todo
    return <>{children}</>;
  }

  const isLoginPage = pathname?.endsWith('/login');

  if (!tenantSlug) {
    return <LoadingScreen message="Cargando..." />;
  }

  if (isLoginPage) {
    return (
      <TenantValidator tenantSlug={tenantSlug}>
        {children}
      </TenantValidator>
    );
  }

  return (
    <TenantValidator tenantSlug={tenantSlug}>
      <PortalProvider>
        <PortalContent>
          {children}
        </PortalContent>
      </PortalProvider>
    </TenantValidator>
  );
}
