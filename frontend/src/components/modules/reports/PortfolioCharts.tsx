'use client';

// =====================================================
// COMPONENTE: PortfolioCharts
// Gráficos de análisis de cartera
// =====================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  PortfolioByLine,
  PortfolioByInsurer,
  PremiumTrend,
  LINE_LABELS,
  CHART_COLORS,
} from '@/lib/validations/reports';
import { PieChartIcon, BarChart3, TrendingUp } from 'lucide-react';

interface PortfolioChartsProps {
  byLineData: PortfolioByLine[];
  byInsurerData: PortfolioByInsurer[];
  trendData: PremiumTrend[];
  isLoading: boolean;
}

// Formatear moneda para tooltips
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Tooltip personalizado para PieChart
const CustomPieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percentage: number } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          Prima: {formatCurrency(data.value)}
        </p>
        <p className="text-sm text-muted-foreground">
          Porcentaje: {data.payload.percentage?.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

// Tooltip personalizado para BarChart
const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          Prima: {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

// Tooltip personalizado para LineChart
const CustomLineTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-muted-foreground">
            {entry.dataKey === 'premium' ? 'Prima' : 'Pólizas'}:{' '}
            {entry.dataKey === 'premium'
              ? formatCurrency(entry.value)
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function PortfolioCharts({
  byLineData,
  byInsurerData,
  trendData,
  isLoading,
}: PortfolioChartsProps) {
  // Preparar datos para PieChart de líneas
  const pieData = byLineData.map((item, index) => ({
    name: LINE_LABELS[item.line] || item.line,
    value: item.premium,
    percentage: item.percentage,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  // Preparar datos para BarChart de aseguradoras
  const barData = byInsurerData.map((item) => ({
    name: item.insurer,
    premium: item.premium,
    count: item.count,
  }));

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
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
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* PieChart - Por Ramo */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Distribución por Ramo</CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Sin datos disponibles
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={({ name, payload }: any) => `${name} (${payload?.percentage?.toFixed(0) || 0}%)`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* BarChart - Por Aseguradora */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Prima por Aseguradora</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Sin datos disponibles
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    value >= 1000000
                      ? `$${(value / 1000000).toFixed(0)}M`
                      : `$${(value / 1000).toFixed(0)}K`
                  }
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="premium" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* LineChart - Tendencia */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Tendencia de Primas (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Sin datos disponibles
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tickFormatter={(value) =>
                    value >= 1000000
                      ? `$${(value / 1000000).toFixed(0)}M`
                      : value >= 1000
                      ? `$${(value / 1000).toFixed(0)}K`
                      : `$${value}`
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomLineTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="premium"
                  name="Prima"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PortfolioCharts;
