'use client';

// =====================================================
// PAGE: Super Admin - Platform Analytics
// Métricas globales de la plataforma
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { getUntypedClient } from '@/lib/supabase/untyped-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/ui/spinner';
import {
  Building2,
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  Brain,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  totalUsers: number;
  totalClients: number;
  totalPolicies: number;
  activePolicies: number;
  totalClaims: number;
  totalComparisons: number;
}

interface TenantNearLimit {
  id: string;
  name: string;
  slug: string;
  clients_count: number;
  policies_count: number;
  usage_percent: number;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenantsNearLimit, setTenantsNearLimit] = useState<TenantNearLimit[]>([]);
  const [historicalData, setHistoricalData] = useState<Array<{ date: string; tenants: number; clients: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = getUntypedClient();

  const fetchAnalytics = useCallback(async () => {
    try {
      // Stats básicas
      const [tenantsRes, usersRes, clientsRes, policiesRes, claimsRes, comparisonsRes] = await Promise.all([
        supabase.from('tenants').select('id, is_active'),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('policies').select('id, status'),
        supabase.from('claims').select('id', { count: 'exact', head: true }),
        supabase.from('comparisons').select('id', { count: 'exact', head: true }),
      ]);

      const tenantsData = (tenantsRes.data || []) as Array<{ id: string; is_active: boolean }>;
      const policiesData = (policiesRes.data || []) as Array<{ id: string; status: string }>;

      setStats({
        totalTenants: tenantsData.length,
        activeTenants: tenantsData.filter(t => t.is_active).length,
        inactiveTenants: tenantsData.filter(t => !t.is_active).length,
        totalUsers: usersRes.count || 0,
        totalClients: clientsRes.count || 0,
        totalPolicies: policiesData.length,
        activePolicies: policiesData.filter(p => p.status === 'active').length,
        totalClaims: claimsRes.count || 0,
        totalComparisons: comparisonsRes.count || 0,
      });

      // Tenants cerca del límite (simulado - asumiendo límite de 1000 clientes)
      const LIMIT = 1000;
      const tenantsWithUsage: TenantNearLimit[] = [];

      for (const tenant of tenantsData) {
        const { count: clientsCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        const { count: policiesCount } = await supabase
          .from('policies')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);

        const { data: tenantInfo } = await supabase
          .from('tenants')
          .select('name, slug')
          .eq('id', tenant.id)
          .single();

        const tenantData = tenantInfo as { name: string; slug: string } | null;
        const usagePercent = ((clientsCount || 0) / LIMIT) * 100;

        if (usagePercent >= 70) {
          tenantsWithUsage.push({
            id: tenant.id,
            name: tenantData?.name || 'Unknown',
            slug: tenantData?.slug || 'unknown',
            clients_count: clientsCount || 0,
            policies_count: policiesCount || 0,
            usage_percent: usagePercent,
          });
        }
      }

      setTenantsNearLimit(tenantsWithUsage.sort((a, b) => b.usage_percent - a.usage_percent).slice(0, 5));

      // Datos históricos (simulados para demostración)
      const historical = [];
      for (let i = 30; i >= 0; i -= 5) {
        const date = subDays(new Date(), i);
        historical.push({
          date: format(date, 'd MMM', { locale: es }),
          tenants: Math.max(0, tenantsData.length - Math.floor(i / 5)),
          clients: Math.max(0, (clientsRes.count || 0) - Math.floor(i * 10)),
        });
      }
      setHistoricalData(historical);

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading || !stats) {
    return <LoadingScreen message="Cargando analytics..." />;
  }

  const pieData = [
    { name: 'Activos', value: stats.activeTenants },
    { name: 'Inactivos', value: stats.inactiveTenants },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics de Plataforma</h1>
        <p className="text-zinc-400 mt-1">Métricas globales y KPIs del sistema</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Tenants Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-white">{stats.totalTenants}</span>
            <p className="text-xs text-green-400 mt-1">
              {stats.activeTenants} activos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuarios Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-white">{stats.totalUsers}</span>
            <p className="text-xs text-zinc-500 mt-1">
              En todas las agencias
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pólizas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-white">{stats.activePolicies}</span>
            <p className="text-xs text-zinc-500 mt-1">
              de {stats.totalPolicies} totales
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Comparativos IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-white">{stats.totalComparisons}</span>
            <p className="text-xs text-zinc-500 mt-1">
              Generados con IA
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart */}
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              Crecimiento de Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tenants"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Tenants"
                  />
                  <Line
                    type="monotone"
                    dataKey="clients"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Clientes"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-500" />
              Estado de Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-zinc-400">Activos ({stats.activeTenants})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-zinc-400">Inactivos ({stats.inactiveTenants})</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upsell Opportunities */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Oportunidades de Upsell
            <span className="text-xs font-normal text-zinc-500 ml-2">
              Tenants cerca del límite de su plan
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsNearLimit.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">
              No hay tenants cerca del límite actualmente
            </p>
          ) : (
            <div className="space-y-4">
              {tenantsNearLimit.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-white">{tenant.name}</p>
                    <p className="text-sm text-zinc-500">
                      {tenant.clients_count} clientes · {tenant.policies_count} pólizas
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            tenant.usage_percent >= 90
                              ? 'bg-red-500'
                              : tenant.usage_percent >= 80
                              ? 'bg-amber-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(tenant.usage_percent, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-zinc-400 w-12 text-right">
                        {tenant.usage_percent.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Usage Stats (Placeholder) */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Uso de IA del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-zinc-800/50 rounded-lg">
              <p className="text-3xl font-bold text-white">{stats.totalComparisons}</p>
              <p className="text-sm text-zinc-400 mt-1">Llamadas API</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/50 rounded-lg">
              <p className="text-3xl font-bold text-white">~{(stats.totalComparisons * 2500).toLocaleString()}</p>
              <p className="text-sm text-zinc-400 mt-1">Tokens consumidos</p>
            </div>
            <div className="text-center p-4 bg-zinc-800/50 rounded-lg">
              <p className="text-3xl font-bold text-white">${(stats.totalComparisons * 0.015).toFixed(2)}</p>
              <p className="text-sm text-zinc-400 mt-1">Costo estimado</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
