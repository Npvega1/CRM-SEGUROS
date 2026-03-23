'use client';

// =====================================================
// COMPONENTE: UsageProgress
// Barra de progreso de uso mensual de comparativos
// =====================================================

import { Progress } from '@/components/ui/progress';
import type { UsageStats } from '@/lib/validations/comparisons';
import { AlertCircle } from 'lucide-react';

interface UsageProgressProps {
  stats: UsageStats;
  isLoading?: boolean;
}

export function UsageProgress({ stats, isLoading }: UsageProgressProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg animate-pulse">
        <div className="flex-1">
          <div className="h-4 bg-slate-200 rounded w-48 mb-2" />
          <div className="h-2 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  const isNearLimit = stats.percentage >= 80;
  const isAtLimit = stats.remaining === 0;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg ${
      isAtLimit ? 'bg-red-50 border border-red-200' : 
      isNearLimit ? 'bg-yellow-50 border border-yellow-200' : 
      'bg-slate-50'
    }`}>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Uso del mes: {stats.used} de {stats.limit} comparativos
          </span>
          {isAtLimit && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              Límite alcanzado
            </span>
          )}
          {isNearLimit && !isAtLimit && (
            <span className="text-xs text-yellow-600">
              {stats.remaining} restantes
            </span>
          )}
        </div>
        <Progress 
          value={stats.percentage} 
          className={`h-2 ${
            isAtLimit ? '[&>div]:bg-red-500' : 
            isNearLimit ? '[&>div]:bg-yellow-500' : 
            '[&>div]:bg-primary'
          }`}
        />
      </div>
    </div>
  );
}
