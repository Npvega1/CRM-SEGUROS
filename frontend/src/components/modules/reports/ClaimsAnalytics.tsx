'use client';

// =====================================================
// COMPONENTE: ClaimsAnalytics
// Análisis de siniestros con métricas y gráficos
// =====================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from './KPICard';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ClaimsAnalytics as ClaimsAnalyticsType,
  STATUS_LABELS,
  LINE_LABELS,
  CHART_COLORS,
} from '@/lib/validations/reports';
import {
  AlertTriangle,
  DollarSign,
  Percent,
} from 'lucide-react';

interface ClaimsAnalyticsProps {
  data: ClaimsAnalyticsType | null;
  isLoading: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ClaimsAnalytics({ data, isLoading }: ClaimsAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-slate-200 rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-slate-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-40 bg-slate-200 rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-slate-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay datos de siniestros disponibles</p>
        </CardContent>
      </Card>
    );
  }

  // Preparar datos para gráficos
  const statusChartData = data.claims_by_status.map((item, index) => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const lineChartData = data.claims_by_line.map((item) => ({
    name: LINE_LABELS[item.line] || item.line,
    count: item.count,
    amount: item.amount,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Siniestros Totales"
          value={data.total_claims}
          format="number"
          icon={AlertTriangle}
          color="orange"
        />
        <KPICard
          title="Siniestros Abiertos"
          value={data.open_claims}
          format="number"
          icon={AlertTriangle}
          color="red"
        />
        <KPICard
          title="Promedio Aprobado"
          value={data.avg_approved_amount}
          format="currency"
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Loss Ratio"
          value={data.loss_ratio}
          format="percentage"
          icon={Percent}
          color={data.loss_ratio > 70 ? 'red' : data.loss_ratio > 50 ? 'orange' : 'green'}
        />
      </div>

      {/* Resumen financiero */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen Financiero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Reclamado</p>
              <p className="text-2xl font-bold">{formatCurrency(data.total_claimed)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Aprobado</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(data.total_approved)}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Resueltos</p>
              <p className="text-2xl font-bold text-blue-700">{data.resolved_claims}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Por Estado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Siniestros por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Sin datos
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Por Ramo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Siniestros por Ramo</CardTitle>
          </CardHeader>
          <CardContent>
            {lineChartData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Sin datos
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={lineChartData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Cantidad"
                    fill={CHART_COLORS[0]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ClaimsAnalytics;
