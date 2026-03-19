'use client';

// =====================================================
// COMPONENTE: KPICard
// Card de KPI reutilizable con sparkline y tendencia
// =====================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percentage';
  icon?: React.ElementType;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  isLoading?: boolean;
}

const colorClasses = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
  green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'text-green-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-500' },
  red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'text-red-500' },
};

export function KPICard({
  title,
  value,
  previousValue,
  format = 'number',
  icon: Icon,
  color = 'blue',
  isLoading = false,
}: KPICardProps) {
  // Formatear valor
  const formatValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('es-CO').format(val);
    }
  };

  // Calcular cambio porcentual
  const calculateChange = (): { value: number; type: 'up' | 'down' | 'neutral' } => {
    if (previousValue === undefined || previousValue === 0) {
      return { value: 0, type: 'neutral' };
    }
    const change = ((value - previousValue) / previousValue) * 100;
    return {
      value: Math.abs(change),
      type: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    };
  };

  const change = calculateChange();
  const colors = colorClasses[color];

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-8 w-8 bg-slate-200 rounded-lg" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-20 bg-slate-200 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className={cn('p-2 rounded-lg', colors.bg)}>
            <Icon className={cn('h-4 w-4', colors.icon)} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {previousValue !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {change.type === 'up' && (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            )}
            {change.type === 'down' && (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            {change.type === 'neutral' && (
              <Minus className="h-4 w-4 text-slate-400" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                change.type === 'up' && 'text-green-600',
                change.type === 'down' && 'text-red-600',
                change.type === 'neutral' && 'text-slate-500'
              )}
            >
              {change.value.toFixed(1)}% vs mes anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KPICard;
