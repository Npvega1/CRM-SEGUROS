'use client';

// =====================================================
// COMPONENTE: RenewalReport
// Reporte de pólizas por vencer con estado de gestión
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
import {
  RenewalReportItem,
  LINE_LABELS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_STATUS_COLORS,
  RenewalStatus,
} from '@/lib/validations/reports';
import { getBrowserClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import {
  Calendar,
  Phone,
  Mail,
  AlertTriangle,
  ArrowUpDown,
  Plus,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

interface RenewalReportProps {
  data: RenewalReportItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

type SortKey = 'days_remaining' | 'premium' | 'client_name' | 'end_date';
type SortDirection = 'asc' | 'desc';

export function RenewalReport({ data, isLoading, onRefresh }: RenewalReportProps) {
  const { tenantId, agentId } = useTenant();
  const [sortKey, setSortKey] = useState<SortKey>('days_remaining');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [processingId, setProcessingId] = useState<string | null>(null);

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
        case 'days_remaining':
          aValue = a.days_remaining;
          bValue = b.days_remaining;
          break;
        case 'premium':
          aValue = a.premium;
          bValue = b.premium;
          break;
        case 'client_name':
          aValue = a.client_name;
          bValue = b.client_name;
          break;
        case 'end_date':
          aValue = new Date(a.end_date).getTime();
          bValue = new Date(b.end_date).getTime();
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
      setSortDirection('asc');
    }
  };

  // Crear oportunidad de renovación
  const handleCreateOpportunity = async (item: RenewalReportItem) => {
    if (!tenantId) return;
    
    setProcessingId(item.policy_id);
    try {
      const supabase = getBrowserClient();
      
      // Obtener el primer stage del pipeline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: stages } = await (supabase as any)
        .from('pipeline_stages')
        .select('id')
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: true })
        .limit(1);
      
      if (!stages || stages.length === 0) {
        alert('No hay etapas de pipeline configuradas');
        return;
      }

      // Crear oportunidad
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('opportunities')
        .insert({
          tenant_id: tenantId,
          client_id: item.client_id,
          stage_id: stages[0].id,
          agent_id: agentId || null,
          line: item.line as 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro',
          estimated_premium: item.premium,
          probability: 70,
          close_probability: 70,
          expected_close_date: item.end_date,
          notes: `Renovación de póliza ${item.policy_number}`,
          status: 'active',
        });

      if (error) {
        console.error('Error creating opportunity:', error);
        alert('Error al crear la oportunidad');
      } else {
        // Refrescar datos
        onRefresh();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear la oportunidad');
    } finally {
      setProcessingId(null);
    }
  };

  // Color según días restantes
  const getDaysColor = (days: number): string => {
    if (days <= 7) return 'text-red-600 font-bold';
    if (days <= 15) return 'text-orange-600 font-semibold';
    if (days <= 30) return 'text-yellow-600';
    return 'text-slate-600';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pólizas por Vencer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-200 rounded" />
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
          <CardTitle>Pólizas por Vencer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium text-green-700">\u00a1Excelente!</p>
            <p>No hay pólizas próximas a vencer en el período seleccionado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Resumen por estado
  const summary = {
    total: data.length,
    sinGestion: data.filter((d) => d.renewal_status === 'sin_gestion').length,
    enContacto: data.filter((d) => d.renewal_status === 'en_contacto').length,
    renovado: data.filter((d) => d.renewal_status === 'renovado').length,
    totalPremium: data.reduce((sum, d) => sum + d.premium, 0),
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-slate-50">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="pt-4">
            <p className="text-sm text-red-600">Sin Gestión</p>
            <p className="text-2xl font-bold text-red-700">{summary.sinGestion}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50">
          <CardContent className="pt-4">
            <p className="text-sm text-yellow-600">En Contacto</p>
            <p className="text-2xl font-bold text-yellow-700">{summary.enContacto}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="pt-4">
            <p className="text-sm text-green-600">Renovado</p>
            <p className="text-2xl font-bold text-green-700">{summary.renovado}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-600">Prima Total</p>
            <p className="text-xl font-bold text-blue-700">{formatCurrency(summary.totalPremium)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pólizas por Vencer
            </CardTitle>
          </div>
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
                      onClick={() => handleSort('client_name')}
                      className="-ml-4"
                    >
                      Cliente
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Ramo</TableHead>
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
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('days_remaining')}
                    >
                      Días
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((item) => (
                  <TableRow key={item.policy_id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/clientes/${item.client_id}`}
                          className="font-medium hover:underline"
                        >
                          {item.client_name}
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {item.client_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {item.client_phone}
                            </span>
                          )}
                          {item.client_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {item.client_email}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/polizas/${item.policy_id}`}
                        className="hover:underline"
                      >
                        {item.policy_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.insurer}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {LINE_LABELS[item.line] || item.line}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.premium)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={cn('flex items-center justify-center gap-1', getDaysColor(item.days_remaining))}>
                        {item.days_remaining <= 7 && (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        {item.days_remaining} días
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.end_date).toLocaleDateString('es-CO')}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={RENEWAL_STATUS_COLORS[item.renewal_status as RenewalStatus]}>
                        {RENEWAL_STATUS_LABELS[item.renewal_status as RenewalStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.renewal_status === 'sin_gestion' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateOpportunity(item)}
                          disabled={processingId === item.policy_id}
                          className="h-8"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Crear Oportunidad
                        </Button>
                      )}
                      {item.renewal_status === 'en_contacto' && (
                        <Link href="/pipeline">
                          <Button size="sm" variant="ghost" className="h-8">
                            Ver Pipeline
                          </Button>
                        </Link>
                      )}
                      {item.renewal_status === 'renovado' && (
                        <span className="text-green-600 flex items-center justify-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                        </span>
                      )}
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

export default RenewalReport;
