'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Users, FileText, DollarSign, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBrowserClient } from '@/lib/supabase/client';
import { 
  getAlliedAgentByAuthUserId,
  getAlliedAgentStats 
} from '@/lib/services/allied-agents.service';
import type { AlliedAgent, AlliedAgentStats } from '@/types/allied-agents';

export default function AlliedPortalDashboard() {
  const params = useParams();
  const [agent, setAgent] = useState<AlliedAgent | null>(null);
  const [stats, setStats] = useState<AlliedAgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const alliedAgent = await getAlliedAgentByAuthUserId(user.id);
      if (!alliedAgent?.id) return;

      setAgent(alliedAgent);

      const agentStats = await getAlliedAgentStats(alliedAgent.id);
      setStats(agentStats);
    } catch (error) {
      toast.error('Error al cargar datos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          ¡Hola, {agent?.full_name?.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido a tu portal de aliado. Aquí puedes ver tus clientes y comisiones.
        </p>
      </div>

      {/* Tarjeta de información del aliado - Sin porcentaje de comisión */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tu información de contacto</p>
              <p className="text-lg font-semibold text-primary mt-1">{agent?.full_name}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Email:</strong> {agent?.email}</p>
              <p><strong>Teléfono:</strong> {agent?.phone}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tus Clientes</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_clients || 0}</div>
            <p className="text-xs text-muted-foreground">Clientes vinculados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pólizas Activas</CardTitle>
            <FileText className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_policies || 0}</div>
            <p className="text-xs text-muted-foreground">Pólizas de tus clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(stats?.pending_commissions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Por recibir</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Pagadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(stats?.paid_commissions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total recibido</p>
          </CardContent>
        </Card>
      </div>

      {/* Prima total */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Prima Total Generada</CardTitle>
          <DollarSign className="h-4 w-4 text-violet-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrency(stats?.total_premium || 0)}</div>
          <p className="text-xs text-muted-foreground">
            Suma de todas las primas de pólizas de tus clientes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
