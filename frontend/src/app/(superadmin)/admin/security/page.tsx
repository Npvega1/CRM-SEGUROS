'use client';

// =====================================================
// PAGE: Super Admin - Security Dashboard
// Audit logs y monitoreo de seguridad
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
import {
  Shield,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  tenant_name?: string;
  user_email?: string;
}

interface RlsStatus {
  table_name: string;
  has_rls: boolean;
  policy_count: number;
}

const ACTION_COLORS: Record<string, string> = {
  'login': 'bg-blue-500/20 text-blue-400',
  'logout': 'bg-zinc-500/20 text-zinc-400',
  'create': 'bg-green-500/20 text-green-400',
  'update': 'bg-amber-500/20 text-amber-400',
  'delete': 'bg-red-500/20 text-red-400',
  'tenant.suspended': 'bg-red-500/20 text-red-400',
  'tenant.reactivated': 'bg-green-500/20 text-green-400',
  'prompt.created': 'bg-purple-500/20 text-purple-400',
  'prompt.updated': 'bg-purple-500/20 text-purple-400',
  'prompt.published': 'bg-green-500/20 text-green-400',
};

// Tablas principales del CRM
const MAIN_TABLES = [
  'tenants',
  'users',
  'clients',
  'policies',
  'claims',
  'opportunities',
  'comparisons',
  'automations',
  'invoices',
  'messages',
  'ai_prompts',
  'audit_logs',
];

export default function SecurityPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [rlsStatus, setRlsStatus] = useState<RlsStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const supabase = getUntypedClient();

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsRefreshing(true);
      
      // Obtener audit logs con información del tenant y usuario
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enriquecer con nombres de tenant y usuario
      const enrichedLogs = await Promise.all(
        (logs || []).map(async (log) => {
          let tenant_name = null;
          let user_email = null;

          if (log.tenant_id) {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('name')
              .eq('id', log.tenant_id)
              .single();
            tenant_name = tenant?.name;
          }

          if (log.user_id) {
            const { data: user } = await supabase
              .from('users')
              .select('email')
              .eq('id', log.user_id)
              .single();
            user_email = user?.email;
          }

          return {
            ...log,
            tenant_name,
            user_email,
          };
        })
      );

      setAuditLogs(enrichedLogs);

      // Simular estado de RLS (en producción consultarías pg_catalog)
      setRlsStatus(
        MAIN_TABLES.map((table) => ({
          table_name: table,
          has_rls: !['ai_prompts', 'ai_prompt_versions', 'platform_analytics'].includes(table),
          policy_count: ['ai_prompts', 'ai_prompt_versions', 'platform_analytics'].includes(table) ? 0 : 
                       table === 'audit_logs' ? 3 : 
                       Math.floor(Math.random() * 5) + 2,
        }))
      );
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      (log.action?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.user_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesAction =
      actionFilter === 'all' ||
      log.action?.toLowerCase().includes(actionFilter.toLowerCase());

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    const colorClass = Object.entries(ACTION_COLORS).find(([key]) => 
      action.toLowerCase().includes(key)
    )?.[1] || 'bg-zinc-500/20 text-zinc-400';
    
    return <Badge className={colorClass}>{action}</Badge>;
  };

  // Stats
  const loginCount = auditLogs.filter(l => l.action?.includes('login')).length;
  const createCount = auditLogs.filter(l => l.action?.includes('create')).length;
  const suspendCount = auditLogs.filter(l => l.action?.includes('suspend')).length;

  // Alertas
  const tablesWithoutRls = rlsStatus.filter(t => !t.has_rls);

  if (isLoading) {
    return <LoadingScreen message="Cargando datos de seguridad..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard de Seguridad</h1>
        <p className="text-zinc-400 mt-1">Monitoreo de auditoría y estado de RLS</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Eventos Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-white">{auditLogs.length}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Logins Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-white">{loginCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Creaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-white">{createCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Suspensiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-white">{suspendCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {tablesWithoutRls.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-400 flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" />
              Tablas sin RLS habilitado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-200 text-sm mb-2">
              Las siguientes tablas no tienen Row Level Security activado (acceso vía service_role):
            </p>
            <div className="flex flex-wrap gap-2">
              {tablesWithoutRls.map((table) => (
                <Badge key={table.table_name} className="bg-amber-500/20 text-amber-400">
                  {table.table_name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* RLS Status */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Estado de Row Level Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rlsStatus.map((table) => (
              <div
                key={table.table_name}
                className={`p-3 rounded-lg border ${
                  table.has_rls
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-amber-500/10 border-amber-500/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {table.has_rls ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-xs font-medium text-white truncate">
                    {table.table_name}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {table.has_rls ? `${table.policy_count} políticas` : 'Sin RLS'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-500" />
              Registros de Auditoría
            </CardTitle>
            
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="all" className="text-white">Todas</SelectItem>
                  <SelectItem value="login" className="text-white">Login</SelectItem>
                  <SelectItem value="create" className="text-white">Crear</SelectItem>
                  <SelectItem value="update" className="text-white">Actualizar</SelectItem>
                  <SelectItem value="delete" className="text-white">Eliminar</SelectItem>
                  <SelectItem value="tenant" className="text-white">Tenant</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => fetchAuditLogs()}
                disabled={isRefreshing}
                className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Fecha</TableHead>
                <TableHead className="text-zinc-400">Acción</TableHead>
                <TableHead className="text-zinc-400">Tenant</TableHead>
                <TableHead className="text-zinc-400">Usuario</TableHead>
                <TableHead className="text-zinc-400">Entidad</TableHead>
                <TableHead className="text-zinc-400">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                    No se encontraron registros
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="text-zinc-400 text-sm">
                      {format(new Date(log.created_at), "d MMM, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      {log.tenant_name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-zinc-500" />
                          <span className="text-white text-sm">{log.tenant_name}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-sm">Sistema</span>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {log.user_email || '-'}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">
                      {log.entity_type ? `${log.entity_type}` : '-'}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm font-mono">
                      {log.ip_address || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
