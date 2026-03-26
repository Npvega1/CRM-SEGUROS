'use client';

import { useState, useEffect } from 'react';
import { Loader2, Download, Users, FileText, DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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

import { getAlliedAgentsReport } from '@/lib/services/allied-agents.service';
import type { AlliedAgentReport } from '@/types/allied-agents';

export default function ReportsPage() {
  const [reports, setReports] = useState<AlliedAgentReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await getAlliedAgentsReport();
      setReports(data);
    } catch (error) {
      toast.error('Error al cargar reportes');
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

  const totals = reports.reduce(
    (acc, report) => ({
      clients: acc.clients + report.total_clients,
      policies: acc.policies + report.total_policies,
      premium: acc.premium + report.total_premium,
      pending: acc.pending + report.pending_commissions,
      paid: acc.paid + report.paid_commissions,
    }),
    { clients: 0, policies: 0, premium: 0, pending: 0, paid: 0 }
  );

  const exportToCSV = () => {
    if (reports.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = [
      'Aliado',
      '% Comisión',
      'Clientes',
      'Pólizas',
      'Prima Total',
      'Comisiones Pendientes',
      'Comisiones Pagadas',
      'Total Comisiones',
    ];

    const rows = reports.map((report) => [
      report.allied_agent_name,
      `${report.commission_percentage}%`,
      report.total_clients,
      report.total_policies,
      report.total_premium,
      report.pending_commissions,
      report.paid_commissions,
      report.total_commissions,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_aliados_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Reporte exportado exitosamente');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reportes de Aliados</h1>
          <p className="text-muted-foreground mt-1">
            Resumen de rendimiento de tus agentes aliados
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={loading || reports.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Tarjetas de resumen general */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Aliados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground">Aliados activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Referidos</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.clients}</div>
            <p className="text-xs text-muted-foreground">Total de clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pólizas Generadas</CardTitle>
            <FileText className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.policies}</div>
            <p className="text-xs text-muted-foreground">Total de pólizas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prima Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.premium)}</div>
            <p className="text-xs text-muted-foreground">Suma de primas</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de comisiones */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Pendientes</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(totals.pending)}</div>
            <p className="text-xs text-muted-foreground">Por pagar a aliados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Pagadas</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.paid)}</div>
            <p className="text-xs text-muted-foreground">Ya pagadas a aliados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de reportes por aliado */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Aliado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>No hay aliados con actividad</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aliado</TableHead>
                  <TableHead>% Comisión</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-center">Pólizas</TableHead>
                  <TableHead className="text-right">Prima Total</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Total Comisiones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.allied_agent_id}>
                    <TableCell className="font-medium">{report.allied_agent_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.commission_percentage}%</Badge>
                    </TableCell>
                    <TableCell className="text-center">{report.total_clients}</TableCell>
                    <TableCell className="text-center">{report.total_policies}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.total_premium)}</TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatCurrency(report.pending_commissions)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatCurrency(report.paid_commissions)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(report.total_commissions)}
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
