'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  FileText, 
  DollarSign, 
  LogOut,
  Menu,
  X,
  User,
  Settings
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getBrowserClient } from '@/lib/supabase/client';
import { getAlliedAgentByAuthUserId } from '@/lib/services/allied-agents.service';
import type { AlliedAgent } from '@/types/allied-agents';

interface LayoutProps {
  children: React.ReactNode;
}

export default function AlliedPortalLayout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;
  
  const [agent, setAgent] = useState<AlliedAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const basePath = `/${tenantSlug}/aliado`;

  const navigation = [
    { name: 'Dashboard', href: basePath, icon: LayoutDashboard },
    { name: 'Mis Pólizas', href: `${basePath}/polizas`, icon: FileText },
    { name: 'Mis Comisiones', href: `${basePath}/comisiones`, icon: DollarSign },
    { name: 'Configuración', href: `${basePath}/configuracion`, icon: Settings },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/${tenantSlug}/aliado/login`);
        return;
      }

      // Verificar que es un aliado
      if (user.app_metadata?.role !== 'allied_agent') {
        router.push(`/${tenantSlug}/aliado/login`);
        return;
      }

      const alliedAgent = await getAlliedAgentByAuthUserId(user.id);
      
      if (!alliedAgent) {
        router.push(`/${tenantSlug}/aliado/login`);
        return;
      }

      setAgent(alliedAgent);
    } catch (error) {
      console.error('Error checking auth:', error);
      router.push(`/${tenantSlug}/aliado/login`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    router.push(`/${tenantSlug}/aliado/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <h1 className="text-xl font-bold text-primary">Portal Aliado</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{agent?.full_name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:pt-16 lg:border-r bg-white">
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Sidebar - Mobile */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
            <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="pt-20 px-4">
                <nav className="space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-gray-100'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 lg:pl-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
