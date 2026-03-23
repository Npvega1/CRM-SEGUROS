'use client';

// =====================================================
// COMPONENT: Tenant Detail Drawer
// Panel lateral con detalles completos del tenant
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Building2,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agents_count: number;
  clients_count: number;
  policies_count: number;
  last_activity: string | null;
}

interface TenantMetrics {
  users: Array<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
  }>;
  recentActivities: Array<{
    action: string;
    created_at: string;
    entity_type: string | null;
  }>;
  claims_count: number;
  opportunities_count: number;
  comparisons_count: number;
}

interface TenantDetailDrawerProps {
  tenant: TenantWithStats | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TenantDetailDrawer({ tenant, isOpen, onClose }: TenantDetailDrawerProps) {
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const supabase = getUntypedClient();

  const fetchMetrics = useCallback(async () => {
    if (!tenant) return;
    
    setIsLoading(true);
    try {
      // Obtener usuarios del tenant
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_active, last_login_at')
        .eq('tenant_id', tenant.id)
        .order('last_login_at', { ascending: false, nullsFirst: false });

      // Obtener actividades recientes
      const { data: activities } = await supabase
        .from('audit_logs')
        .select('action, created_at, entity_type')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Conteos adicionales
      const { count: claims_count } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      const { count: opportunities_count } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      const { count: comparisons_count } = await supabase
        .from('comparisons')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      setMetrics({
        users: users || [],
        recentActivities: activities || [],
        claims_count: claims_count || 0,
        opportunities_count: opportunities_count || 0,
        comparisons_count: comparisons_count || 0,
      });
    } catch (error) {
      console.error('Error fetching tenant metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant, supabase]);

  useEffect(() => {
    if (isOpen && tenant) {
      fetchMetrics();
    }
  }, [isOpen, tenant, fetchMetrics]);

  if (!tenant) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg bg-zinc-900 border-zinc-800 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-red-500" />
                {tenant.name}
              </SheetTitle>
              <p className="text-sm text-zinc-500 mt-1 font-mono">{tenant.slug}</p>
            </div>
            <Badge
              className={tenant.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
            >
              {tenant.is_active ? 'Activo' : 'Suspendido'}
            </Badge>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold text-white">{tenant.agents_count}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Agentes</p>
              </CardContent>
            </Card>
            
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span className="text-2xl font-bold text-white">{tenant.clients_count}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Clientes</p>
              </CardContent>
            </Card>
            
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-white">{tenant.policies_count}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Pólizas</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-2xl font-bold text-white">{metrics?.claims_count || 0}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Siniestros</p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Métricas adicionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Oportunidades
                </span>
                <span className="text-white font-medium">{metrics?.opportunities_count || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Comparativos IA
                </span>
                <span className="text-white font-medium">{metrics?.comparisons_count || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Creado
                </span>
                <span className="text-white font-medium">
                  {format(new Date(tenant.created_at), "d MMM yyyy", { locale: es })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Última actividad
                </span>
                <span className="text-white font-medium">
                  {tenant.last_activity
                    ? format(new Date(tenant.last_activity), "d MMM, HH:mm", { locale: es })
                    : 'Sin actividad'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuarios ({metrics?.users.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-zinc-500 text-sm">Cargando...</p>
              ) : metrics?.users.length === 0 ? (
                <p className="text-zinc-500 text-sm">No hay usuarios</p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {metrics?.users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center">
                          <span className="text-xs font-medium text-white">
                            {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-white">{user.full_name}</p>
                          <p className="text-xs text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                          {user.role}
                        </Badge>
                        {!user.is_active && (
                          <Badge className="ml-1 bg-red-500/20 text-red-400 text-xs">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Actividad reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-zinc-500 text-sm">Cargando...</p>
              ) : metrics?.recentActivities.length === 0 ? (
                <p className="text-zinc-500 text-sm">Sin actividad registrada</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {metrics?.recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400 truncate">{activity.action}</span>
                      <span className="text-zinc-600 text-xs">
                        {format(new Date(activity.created_at), "d MMM, HH:mm", { locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="pt-4 border-t border-zinc-800">
            <Button
              variant="outline"
              className="w-full border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => window.open(`/${tenant.slug}/dashboard`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver como usuario
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
