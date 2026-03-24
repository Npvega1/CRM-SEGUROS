'use client';

// =====================================================
// LAYOUT: Super Admin Panel
// Layout diferenciado con color oscuro/rojo
// =====================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { LoadingScreen } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import {
  Building2,
  Brain,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight,
  AlertTriangle,
  Database,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { title: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { title: 'Catálogos', href: '/admin/catalogos', icon: Database },
  { title: 'Prompts IA', href: '/admin/prompts', icon: Brain },
  { title: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { title: 'Seguridad', href: '/admin/security', icon: Shield },
];

interface SuperAdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<SuperAdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = getBrowserClient();

  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }

        // Verificar rol superadmin en app_metadata
        const role = session.user.app_metadata?.role;
        
        if (role !== 'superadmin') {
          console.error('Acceso denegado: no es superadmin');
          router.push('/dashboard');
          return;
        }

        // Obtener datos del usuario
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, full_name, role')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setUser(userData as SuperAdminUser);
        } else {
          // Usar datos de sesión si no hay registro en users
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || 'Super Admin',
            role: 'superadmin'
          });
        }
      } catch (error) {
        console.error('Error verificando superadmin:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkSuperAdmin();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return <LoadingScreen message="Verificando acceso..." />;
  }

  if (!user) {
    return null;
  }

  const isActiveRoute = (href: string) => {
    if (href === '/admin/tenants') {
      return pathname === '/admin' || pathname === '/admin/tenants' || pathname.startsWith('/admin/tenants');
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-zinc-900 border-r border-zinc-800">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
          <div className="h-9 w-9 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-white truncate">CRM Seguros</p>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">
                SUPER ADMIN
              </span>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mx-3 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200">
              Acceso global sin restricciones RLS. Actúa con precaución.
            </p>
          </div>
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
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
                data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.title}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-zinc-800 px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-sm font-medium text-red-400">
                {user.full_name?.charAt(0)?.toUpperCase() || 'S'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={handleSignOut}
            data-testid="superadmin-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              data-testid="mobile-menu-toggle"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-sm text-white">Super Admin</span>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">
            SA
          </span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-white">Super Admin</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Navigation */}
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
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile User Section */}
        <div className="border-t border-zinc-800 px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-sm font-medium text-red-400">
                {user.full_name?.charAt(0)?.toUpperCase() || 'S'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={handleSignOut}
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
        <div className="min-h-screen bg-zinc-950">
          {children}
        </div>
      </main>
    </div>
  );
}
