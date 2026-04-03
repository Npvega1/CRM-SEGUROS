'use client';

// =====================================================
// COMPONENT: Tenant Detail Drawer
// Panel lateral con detalles completos del tenant
// Actualizado: Toggle de IA agregado
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Sparkles,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  ai_enabled?: boolean;
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
  onTenantUpdate?: () => void;
}

export function TenantDetailDrawer({ tenant, isOpen, onClose, onTenantUpdate }: TenantDetailDrawerProps) {
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [isTogglingAI, setIsTogglingAI] = useState(false);

  const supabase = getUntypedClient();

  // Inicializar estado de IA cuando cambia el tenant
  useEffect(() => {
    if (tenant) {
      setAiEnabled(tenant.ai_enabled || false);
    }
  }, [tenant]);

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

  // Handler para toggle de IA
  const handleAIToggle = async (enabled: boolean) => {
    if (!tenant) return;

    setIsTogglingAI(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ ai_enabled: enabled })
        .eq('id', tenant.id);

      if (error) throw error;

      setAiEnabled(enabled);
      
      // Notificar al componente padre para refrescar la lista
      if (onTenantUpdate) {
        onTenantUpdate();
      }
    } catch (error) {
      console.error('Error updating AI status:', error);
      // Revertir el estado en caso de error
      setAiEnabled(!enabled);
      alert('Error al actualizar el estado de IA');
    } finally {
      setIsTogglingAI(false);
    }
  };

  if (!tenant) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {tenant.name}
          </SheetTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/{tenant.slug}</span>
            <Badge variant={tenant.is_active ? 'default' : 'destructive'}>
              {tenant.is_active ? 'Activo' : 'Suspendido'}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-4">

          {/* AI Toggle Section */}
          <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Servicio de Inteligencia Artificial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="ai-toggle" className="text-sm font-medium">
                    Lectura automática de pólizas
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Permite a los usuarios cargar PDFs y extraer datos automáticamente
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isTogglingAI && <Loader2 className="h-4 w-4 animate-spin text-purple-600" />}
                  <Switch
                    id="ai-toggle"
                    checked={aiEnabled}
                    onCheckedChange={handleAIToggle}
                    disabled={isTogglingAI}
                  />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Estado actual:</span>
                  <Badge variant={aiEnabled ? 'default' : 'secondary'} className={aiEnabled ? 'bg-purple-600' : ''}>
                    {aiEnabled ? 'Habilitado' : 'Deshabilitado'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{tenant.agents_count}</div>
              <div className="text-xs text-muted-foreground">Agentes</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{tenant.clients_count}</div>
              <div className="text-xs text-muted-foreground">Clientes</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{tenant.policies_count}</div>
              <div className="text-xs text-muted-foreground">Pólizas</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{metrics?.claims_count || 0}</div>
              <div className="text-xs text-muted-foreground">Siniestros</div>
            </div>
          </div>

          {/* Additional Metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Métricas adicionales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Oportunidades</span>
                <span className="font-medium">{metrics?.opportunities_count || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comparativos IA</span>
                <span className="font-medium">{metrics?.comparisons_count || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Creado
                </span>
                <span className="font-medium">
                  {format(new Date(tenant.created_at), "d MMM yyyy", { locale: es })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Última actividad
                </span>
                <span className="font-medium">
                  {tenant.last_activity
                    ? format(new Date(tenant.last_activity), "d MMM, HH:mm", { locale: es })
                    : 'Sin actividad'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuarios ({metrics?.users.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
                </div>
              ) : metrics?.users.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No hay usuarios
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {metrics?.users.map((user) => (
                    <div key={user.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{user.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {user.role}
                      </Badge>
                      {!user.is_active && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Actividad reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
                </div>
              ) : metrics?.recentActivities.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Sin actividad registrada
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {metrics?.recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted">
                      <span className="truncate">{activity.action}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {format(new Date(activity.created_at), "d MMM, HH:mm", { locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
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
