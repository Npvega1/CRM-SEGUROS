'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  getAlliedAgentCommissions,
  updateCommissionStatus,
  getActiveAlliedAgents,
} from '@/lib/services/allied-agents.service';
import type { AlliedAgentCommissionWithPolicy, AlliedAgent } from '@/types/allied-agents';

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<AlliedAgentCommissionWithPolicy[]>([]);
  const [agents, setAgents] = useState<AlliedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [commissionsData, agentsData] = await Promise.all([
        getAlliedAgentCommissions(),
        getActiveAlliedAgents(),
      ]);
      setCommissions(commissionsData);
      setAgents(agentsData);
    } catch (error) {
      toast.error('Error al cargar comisiones');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (commissionId: string, newStatus: 'pending' | 'paid') => {
    setUpdating(commissionId);
    try {
      await updateCommissionStatus(commissionId, newStatus);
      toast.success(newStatus === 'paid' ? 'Comisión marcada como pagada' : 'Comisión marcada como pendiente');
      loadData();
    } catch (error) {
      toast.error('Error al actualizar estado');
      console.error(error);
    } finally {
      setUpdating(null);
    }
  };

  const filteredCommissions = commissions.filter(commission => {
    const matchesSearch = 
      commission.allied_agent?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      commission.policy?.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      commission.policy?.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || commission.status === statusFilter;
    const matchesAgent = agentFilter === 'all' || commission.allied_agent_id === agentFilter;
    
    return matchesSearch && matchesStatus && matchesAgent;
  });

  const totals = {
    pending: filteredCommissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0),
    paid: filteredCommissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0),
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comisiones de Aliados</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona las comisiones pendientes y pagadas
        </p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(totals.pending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.paid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total General</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.pending + totals.paid)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por aliado, póliza o cliente..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="paid">Pagadas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Aliado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los aliados</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id!}>
                    {agent.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de comisiones */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCommissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>No hay comisiones registradas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aliado</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Prima</TableHead>
                  <TableHead>% Aliado</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">
                      {commission.allied_agent?.full_name || '-'}
                    </TableCell>
                    <TableCell>{commission.policy?.policy_number || '-'}</TableCell>
                    <TableCell>{commission.policy?.client?.full_name || '-'}</TableCell>
                    <TableCell>{formatCurrency(commission.policy_premium || 0)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{commission.agent_commission_percentage}%</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(commission.commission_amount || 0)}
                    </TableCell>
                    <TableCell>
                      {commission.status === 'paid' ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Pagada</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(commission.paid_at)}</TableCell>
                    <TableCell className="text-right">
                      {commission.status === 'pending' ? (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(commission.id!, 'paid')}
                          disabled={updating === commission.id}
                        >
                          {updating === commission.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Marcar Pagada'
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(commission.id!, 'pending')}
                          disabled={updating === commission.id}
                        >
                          {updating === commission.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Revertir'
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
