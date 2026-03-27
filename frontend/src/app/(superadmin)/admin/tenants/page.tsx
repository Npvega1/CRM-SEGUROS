'use client';

// =====================================================
// PAGE: Super Admin - Tenants Management
// Lista global de todos los tenants con métricas
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingScreen } from '@/components/ui/spinner';
import { TenantDetailDrawer } from '@/components/modules/superadmin/TenantDetailDrawer';
import { CreateTenantModal } from '@/components/modules/superadmin/CreateTenantModal';
import {
  Building2,
  Search,
  Plus,
  Users,
  FileText,
  Eye,
  Ban,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Clock,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agents_count: number;
  clients_count: number;
  policies_count: number;
  last_activity: string | null;
  admin_email?: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected' | 'suspended'>('all');
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingTenantId, setProcessingTenantId] = useState<string | null>(null);

  const supabase = getUntypedClient();

  const fetchTenants = useCallback(async () => {
    try {
      setIsRefreshing(true);

      // Obtener todos los tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      // Obtener conteos para cada tenant
      const tenantsWithStats: TenantWithStats[] = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          // Contar usuarios activos
          const { count: agentsCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('is_active', true);

          // Obtener email del admin
          const { data: adminUser } = await supabase
            .from('users')
            .select('email')
            .eq('tenant_id', tenant.id)
            .eq('role', 'admin')
            .limit(1)
            .single();

          // Contar clientes
          const { count: clientsCount } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          // Contar pólizas
          const { count: policiesCount } = await supabase
            .from('policies')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          // Última actividad (último login de cualquier usuario)
          const { data: lastUser } = await supabase
            .from('users')
            .select('last_login_at')
            .eq('tenant_id', tenant.id)
            .order('last_login_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .single();

          return {
            ...tenant,
            status: tenant.status || (tenant.is_active ? 'active' : 'suspended'),
            agents_count: agentsCount || 0,
            clients_count: clientsCount || 0,
            policies_count: policiesCount || 0,
            last_activity: lastUser?.last_login_at || null,
            admin_email: adminUser?.email || null,
          };
        })
      );

      setTenants(tenantsWithStats);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Aprobar tenant
  const handleApproveTenant = async (tenantId: string) => {
    try {
      setProcessingTenantId(tenantId);
      
      const { error } = await supabase
        .from('tenants')
        .update({ status: 'active', is_active: true })
        .eq('id', tenantId);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'tenant.approved',
        entity_type: 'tenant',
        entity_id: tenantId,
        new_values: { status: 'active', is_active: true },
      });

      // TODO: Enviar email de bienvenida aquí
      
      fetchTenants();
    } catch (error) {
      console.error('Error approving tenant:', error);
    } finally {
      setProcessingTenantId(null);
    }
  };

  // Rechazar tenant
  const handleRejectTenant = async (tenantId: string) => {
    try {
      setProcessingTenantId(tenantId);
      
      const { error } = await supabase
        .from('tenants')
        .update({ status: 'rejected', is_active: false })
        .eq('id', tenantId);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'tenant.rejected',
        entity_type: 'tenant',
        entity_id: tenantId,
        new_values: { status: 'rejected', is_active: false },
      });

      fetchTenants();
    } catch (error) {
      console.error('Error rejecting tenant:', error);
    } finally {
      setProcessingTenantId(null);
    }
  };

  // Suspender tenant
  const handleSuspendTenant = async (tenantId: string) => {
    try {
      setProcessingTenantId(tenantId);
      
      const { error } = await supabase
        .from('tenants')
        .update({ status: 'suspended', is_active: false })
        .eq('id', tenantId);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'tenant.suspended',
        entity_type: 'tenant',
        entity_id: tenantId,
        new_values: { status: 'suspended', is_active: false },
      });

      fetchTenants();
    } catch (error) {
      console.error('Error suspending tenant:', error);
    } finally {
      setProcessingTenantId(null);
    }
  };

  // Reactivar tenant
  const handleReactivateTenant = async (tenantId: string) => {
    try {
      setProcessingTenantId(tenantId);
      
      const { error } = await supabase
        .from('tenants')
        .update({ status: 'active', is_active: true })
        .eq('id', tenantId);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'tenant.reactivated',
        entity_type: 'tenant',
        entity_id: tenantId,
        new_values: { status: 'active', is_active: true },
      });

      fetchTenants();
    } catch (error) {
      console.error('Error reactivating tenant:', error);
    } finally {
      setProcessingTenantId(null);
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || tenant.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats cards
  const totalTenants = tenants.length;
  const pendingTenants = tenants.filter(t => t.status === 'pending').length;
  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const totalAgents = tenants.reduce((acc, t) => acc + t.agents_count, 0);
  const totalClients = tenants.reduce((acc, t) => acc + t.clients_count, 0);

  // Helper para badge de status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pendiente</Badge>;
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Activo</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rechazado</Badge>;
      case 'suspended':
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Suspendido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Cargando tenants..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Tenants</h1>
          <p className="text-zinc-400 mt-1">Administra todas las agencias de seguros</p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-red-500 hover:bg-red-600 text-white"
          data-testid="create-tenant-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tenant
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-white">{totalTenants}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pendientes Card - Destacado */}
        <Card className={`border-2 ${pendingTenants > 0 ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-900 border-zinc-800'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-400">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className={`h-5 w-5 ${pendingTenants > 0 ? 'text-amber-500 animate-pulse' : 'text-zinc-500'}`} />
              <span className={`text-2xl font-bold ${pendingTenants > 0 ? 'text-amber-400' : 'text-white'}`}>
                {pendingTenants}
              </span>
              {pendingTenants > 0 && (
                <span className="text-xs text-amber-400 ml-1">¡Requieren revisión!</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-white">{activeTenants}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Agentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-white">{totalAgents}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold text-white">{totalClients}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por nombre o slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
            data-testid="search-tenants"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-white">Todos</SelectItem>
            <SelectItem value="pending" className="text-amber-400">Pendientes</SelectItem>
            <SelectItem value="active" className="text-green-400">Activos</SelectItem>
            <SelectItem value="suspended" className="text-zinc-400">Suspendidos</SelectItem>
            <SelectItem value="rejected" className="text-red-400">Rechazados</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => fetchTenants()}
          disabled={isRefreshing}
          className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Tenants Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Slug</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400 text-center">Agentes</TableHead>
                <TableHead className="text-zinc-400 text-center">Clientes</TableHead>
                <TableHead className="text-zinc-400 text-center">Pólizas</TableHead>
                <TableHead className="text-zinc-400">Última actividad</TableHead>
                <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                    No se encontraron tenants
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow 
                    key={tenant.id} 
                    className={`border-zinc-800 hover:bg-zinc-800/50 ${tenant.status === 'pending' ? 'bg-amber-500/5' : ''}`}
                  >
                    <TableCell className="font-medium text-white">
                      {tenant.name}
                      {tenant.admin_email && (
                        <p className="text-xs text-zinc-500 mt-0.5">{tenant.admin_email}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-400 font-mono text-sm">{tenant.slug}</TableCell>
                    <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                    <TableCell className="text-center text-zinc-300">{tenant.agents_count}</TableCell>
                    <TableCell className="text-center text-zinc-300">{tenant.clients_count}</TableCell>
                    <TableCell className="text-center text-zinc-300">{tenant.policies_count}</TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {tenant.last_activity
                        ? format(new Date(tenant.last_activity), "d MMM yyyy, HH:mm", { locale: es })
                        : 'Sin actividad'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Ver detalle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setIsDrawerOpen(true);
                          }}
                          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                          data-testid={`view-tenant-${tenant.slug}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Acciones según estado */}
                        {tenant.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApproveTenant(tenant.id)}
                              disabled={processingTenantId === tenant.id}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              data-testid={`approve-tenant-${tenant.slug}`}
                              title="Aprobar"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectTenant(tenant.id)}
                              disabled={processingTenantId === tenant.id}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              data-testid={`reject-tenant-${tenant.slug}`}
                              title="Rechazar"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        {tenant.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSuspendTenant(tenant.id)}
                            disabled={processingTenantId === tenant.id}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            data-testid={`suspend-tenant-${tenant.slug}`}
                            title="Suspender"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}

                        {(tenant.status === 'suspended' || tenant.status === 'rejected') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReactivateTenant(tenant.id)}
                            disabled={processingTenantId === tenant.id}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            data-testid={`reactivate-tenant-${tenant.slug}`}
                            title="Reactivar"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tenant Detail Drawer */}
      <TenantDetailDrawer
        tenant={selectedTenant}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTenant(null);
        }}
      />

      {/* Create Tenant Modal */}
      <CreateTenantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchTenants();
        }}
      />
    </div>
  );
}
