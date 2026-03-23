'use client';

// =====================================================
// COMPONENTE: ExecutiveDashboard
// Dashboard ejecutivo con 5 KPIs principales
// =====================================================

import React from 'react';
import { KPICard } from './KPICard';
import { ExecutiveDashboardData } from '@/lib/validations/reports';
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Calendar,
  Wallet,
} from 'lucide-react';

interface ExecutiveDashboardProps {
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
}

export function ExecutiveDashboard({ data, isLoading }: ExecutiveDashboardProps) {
  const kpis = [
    {
      title: 'Pólizas Activas',
      value: data?.active_policies_count ?? 0,
      previousValue: data?.active_policies_prev,
      format: 'number' as const,
      icon: FileText,
      color: 'blue' as const,
    },
    {
      title: 'Prima del Mes',
      value: data?.total_premium_month ?? 0,
      previousValue: data?.total_premium_prev,
      format: 'currency' as const,
      icon: DollarSign,
      color: 'green' as const,
    },
    {
      title: 'Siniestros Abiertos',
      value: data?.open_claims_count ?? 0,
      previousValue: data?.open_claims_prev,
      format: 'number' as const,
      icon: AlertTriangle,
      color: 'orange' as const,
    },
    {
      title: 'Renovaciones (30 días)',
      value: data?.renewals_next_30_days ?? 0,
      format: 'number' as const,
      icon: Calendar,
      color: 'purple' as const,
    },
    {
      title: 'Comisiones Pendientes',
      value: data?.pending_commissions_total ?? 0,
      format: 'currency' as const,
      icon: Wallet,
      color: 'green' as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {kpis.map((kpi, index) => (
        <KPICard
          key={index}
          title={kpi.title}
          value={kpi.value}
          previousValue={kpi.previousValue}
          format={kpi.format}
          icon={kpi.icon}
          color={kpi.color}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}

export default ExecutiveDashboard;
