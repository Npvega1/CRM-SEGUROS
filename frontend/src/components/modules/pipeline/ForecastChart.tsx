'use client';

// =====================================================
// COMPONENTE: ForecastChart
// Gráfico de forecast con Recharts
// =====================================================

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatPremium } from '@/lib/validations/pipeline';

interface ForecastData {
  month: string;
  opportunity_count: number;
  total_premium: number;
  weighted_premium: number;
  by_stage?: {
    stage_id: string;
    stage_name: string;
    stage_color: string;
    count: number;
    premium: number;
    weighted: number;
  }[];
}

interface ForecastChartProps {
  data: ForecastData[];
  isLoading?: boolean;
}

export function ForecastChart({ data, isLoading = false }: ForecastChartProps) {
  const [viewType, setViewType] = useState<'weighted' | 'total'>('weighted');

  // Formatear datos para el gráfico
  const chartData = useMemo(() => {
    return data.map(item => {
      const monthDate = new Date(item.month + '-01');
      const monthLabel = monthDate.toLocaleDateString('es-CO', { 
        month: 'short', 
        year: '2-digit' 
      });

      return {
        name: monthLabel,
        month: item.month,
        'Prima Total': item.total_premium,
        'Prima Ponderada': item.weighted_premium,
        opportunities: item.opportunity_count
      };
    });
  }, [data]);

  // Formatear valores para tooltip
  const formatTooltipValue = (value: number) => formatPremium(value);

  if (isLoading) {
    return (
      <Card data-testid="forecast-chart-loading">
        <CardHeader>
          <CardTitle className="text-lg">Forecast de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card data-testid="forecast-chart-empty">
        <CardHeader>
          <CardTitle className="text-lg">Forecast de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No hay datos de forecast disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="forecast-chart">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Forecast de Ventas</CardTitle>
        <Select value={viewType} onValueChange={(v) => setViewType(v as 'weighted' | 'total')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weighted">Prima Ponderada</SelectItem>
            <SelectItem value="total">Prima Total</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value) => formatTooltipValue(Number(value))}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {viewType === 'weighted' ? (
                <Bar 
                  dataKey="Prima Ponderada" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              ) : (
                <Bar 
                  dataKey="Prima Total" 
                  fill="hsl(142.1 76.2% 36.3%)" 
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {chartData.reduce((sum, item) => sum + item.opportunities, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Oportunidades</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {formatPremium(chartData.reduce((sum, item) => sum + item['Prima Total'], 0))}
            </p>
            <p className="text-xs text-muted-foreground">Prima Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatPremium(chartData.reduce((sum, item) => sum + item['Prima Ponderada'], 0))}
            </p>
            <p className="text-xs text-muted-foreground">Prima Ponderada</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
