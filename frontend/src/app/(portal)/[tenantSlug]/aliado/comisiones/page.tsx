'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Loader2, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { getBrowserClient } from '@/lib/supabase/client';
import { 
  getAlliedAgentByAuthUserId,
  getCommissionsByAlliedAgent 
} from '@/lib/services/allied-agents.service';
import type { AlliedAgentCommissionWithPolicy } from '@/types/allied-agents';

export default function AlliedCommissionsPage() {
  const [commissions, setCommissions] = useState<AlliedAgentCommissionWithPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommissions();
  }, []);

  const loadCommissions = async () => {
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const alliedAgent = await getAlliedAgentByAuthUserId(user.id);
      if (!alliedAgent?.id) return;

      const data = await getCommissionsByAlliedAgent(alliedAgent.id);
      setCommissions(data);
    } catch (error) {
      toast.error('Error al cargar comisiones');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  const totals = {
    pending: commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0),
    paid: commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Comisiones</h1>
        <p className="text-muted-foreground mt-1">
          Historial de todas tus comisiones
        </p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente por Cobrar</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(totals.pending)}
            </div>
            <p className="text-xs text-muted-foreground">
              {commissions.filter(c => c.status === 'pending').length} comisiones pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recibido</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals.paid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {commissions.filter(c => c.status === 'paid').length} comisiones pagadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Histórico</CardTitle>
            <DollarSign className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.pending + totals.paid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {commissions.length} comisiones en total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de comisiones */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Comisiones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <DollarSign className="h-12 w-12 mb-4 opacity-50" />
              <p>Aún no tienes comisiones</p>
              <p className="text-sm">Cuando se generen pólizas de tus referidos, verás tus comisiones aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead className="text-right">Prima</TableHead>
                    <TableHead className="text-right">% Comisión</TableHead>
                    <TableHead className="text-right">Mi Comisión</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="font-medium">
                        {commission.policy?.policy_number || '-'}
                      </TableCell>
                      <TableCell>
                        {commission.policy?.client?.full_name || '-'}
                      </TableCell>
                      <TableCell>
                        {commission.policy?.insurance_company?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(commission.policy_premium)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {commission.agent_commission_percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(commission.commission_amount)}
                      </TableCell>
                      <TableCell>
                        {commission.status === 'paid' ? (
                          <Badge className="bg-emerald-100 text-emerald-800">
                            Pagada
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(commission.paid_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
