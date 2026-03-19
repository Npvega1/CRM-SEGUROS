'use client';

// =====================================================
// COMPONENTE: CommissionsReport
// Reporte de comisiones por póliza y agente
// =====================================================

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CommissionReportItem, LINE_LABELS } from '@/lib/validations/reports';
import { Wallet, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';

interface CommissionsReportProps {
  data: CommissionReportItem[];
  isLoading: boolean;
}

type SortKey = 'commission_amount' | 'premium' | 'client_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

export function CommissionsReport({ data, isLoading }: CommissionsReportProps) {
  const [sortKey, setSortKey] = useState<SortKey>('commission_amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Formatear moneda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Ordenar datos
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortKey) {
        case 'commission_amount':
          aValue = a.commission_amount;
          bValue = b.commission_amount;
          break;
        case 'premium':
          aValue = a.premium;
          bValue = b.premium;
          break;
        case 'client_name':
          aValue = a.client_name;
          bValue = b.client_name;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  // Toggle ordenamiento
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Totales
  const totals = useMemo(() => {
    return {
      totalPremium: data.reduce((sum, item) => sum + item.premium, 0),
      totalCommission: data.reduce((sum, item) => sum + item.commission_amount, 0),
      avgCommissionPct: data.length > 0
        ? data.reduce((sum, item) => sum + item.commission_pct, 0) / data.length
        : 0,
    };
  }, [data]);

  // Agrupado por agente
  const byAgent = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const agentName = item.agent_name || 'Sin asignar';
      if (!acc[agentName]) {
        acc[agentName] = { premium: 0, commission: 0, count: 0 };
      }
      acc[agentName].premium += item.premium;
      acc[agentName].commission += item.commission_amount;
      acc[agentName].count += 1;
      return acc;
    }, {} as Record<string, { premium: number; commission: number; count: number }>);
    
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.commission - a.commission);
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comisiones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comisiones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay datos de comisiones en el período seleccionado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-600">Pólizas</p>
            <p className="text-2xl font-bold text-blue-700">{data.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Prima Total</p>
            <p className="text-xl font-bold">{formatCurrency(totals.totalPremium)}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="pt-4">
            <p className="text-sm text-green-600">Comisión Total</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(totals.totalCommission)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50">
          <CardContent className="pt-4">
            <p className="text-sm text-purple-600">% Promedio</p>
            <p className="text-2xl font-bold text-purple-700">
              {totals.avgCommissionPct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Por Agente */}
      {byAgent.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comisiones por Agente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byAgent.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.count} póliza{agent.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-700">
                      {formatCurrency(agent.commission)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Prima: {formatCurrency(agent.premium)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla Detalle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Detalle de Comisiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('created_at')}
                      className="-ml-4"
                    >
                      Fecha
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('client_name')}
                    >
                      Cliente
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('premium')}
                    >
                      Prima
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('commission_amount')}
                    >
                      Comisión
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((item) => (
                  <TableRow key={item.policy_id}>
                    <TableCell className="text-sm">
                      {new Date(item.created_at).toLocaleDateString('es-CO')}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/polizas/${item.policy_id}`}
                        className="hover:underline font-medium"
                      >
                        {item.policy_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.insurer}</p>
                    </TableCell>
                    <TableCell>{item.client_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {LINE_LABELS[item.line] || item.line}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.agent_name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.premium)}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.commission_pct}%
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-700">
                      {formatCurrency(item.commission_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CommissionsReport;
