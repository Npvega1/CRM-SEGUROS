'use client';

// =====================================================
// COMPONENTE: AgentPerformanceTable
// Tabla de rendimiento de agentes con RadarChart
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
import { AgentPerformanceData, CHART_COLORS } from '@/lib/validations/reports';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { ArrowUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AgentPerformanceTableProps {
  data: AgentPerformanceData[];
  isLoading: boolean;
}

type SortKey = keyof AgentPerformanceData;
type SortDirection = 'asc' | 'desc';

export function AgentPerformanceTable({ data, isLoading }: AgentPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total_premium');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

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
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
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

  // Toggle selección de agente para radar
  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : prev.length < 3
        ? [...prev, agentId]
        : prev
    );
  };

  // Datos para RadarChart
  const radarData = useMemo(() => {
    if (selectedAgents.length === 0) return [];
    
    const selectedData = data.filter((agent) =>
      selectedAgents.includes(agent.agent_id)
    );
    
    // Normalizar datos (0-100)
    const maxValues = {
      policies: Math.max(...data.map((d) => d.policies_created_month), 1),
      premium: Math.max(...data.map((d) => d.total_premium), 1),
      pipeline: Math.max(...data.map((d) => d.pipeline_total), 1),
      won: Math.max(...data.map((d) => d.pipeline_won_month), 1),
      closeRate: 100,
      commissions: Math.max(...data.map((d) => d.commissions_earned_month), 1),
    };
    
    return [
      {
        metric: 'Pólizas',
        ...Object.fromEntries(
          selectedData.map((agent) => [
            agent.agent_name,
            (agent.policies_created_month / maxValues.policies) * 100,
          ])
        ),
      },
      {
        metric: 'Prima',
        ...Object.fromEntries(
          selectedData.map((agent) => [
            agent.agent_name,
            (agent.total_premium / maxValues.premium) * 100,
          ])
        ),
      },
      {
        metric: 'Pipeline',
        ...Object.fromEntries(
          selectedData.map((agent) => [
            agent.agent_name,
            (agent.pipeline_total / maxValues.pipeline) * 100,
          ])
        ),
      },
      {
        metric: 'Ganadas',
        ...Object.fromEntries(
          selectedData.map((agent) => [
            agent.agent_name,
            (agent.pipeline_won_month / maxValues.won) * 100,
          ])
        ),
      },
      {
        metric: 'Tasa Cierre',
        ...Object.fromEntries(
          selectedData.map((agent) => [
            agent.agent_name,
            agent.close_rate,
          ])
        ),
      },
      {
        metric: 'Comisiones',
        ...Object.fromEntries(
          selectedData.map((agent) => [
            agent.agent_name,
            (agent.commissions_earned_month / maxValues.commissions) * 100,
          ])
        ),
      },
    ];
  }, [data, selectedAgents]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento de Agentes</CardTitle>
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
          <CardTitle>Rendimiento de Agentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay datos de agentes disponibles</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Tabla */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Rendimiento de Agentes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecciona hasta 3 agentes para comparar en el gráfico
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('agent_name')}
                      className="-ml-4"
                    >
                      Agente
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('policies_created_month')}
                    >
                      Pólizas
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('total_premium')}
                    >
                      Prima
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('close_rate')}
                    >
                      Cierre %
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('commissions_earned_month')}
                    >
                      Comisiones
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((agent) => (
                  <TableRow
                    key={agent.agent_id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      selectedAgents.includes(agent.agent_id) && 'bg-primary/5'
                    )}
                    onClick={() => toggleAgentSelection(agent.agent_id)}
                  >
                    <TableCell>
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border-2',
                          selectedAgents.includes(agent.agent_id)
                            ? 'border-primary bg-primary'
                            : 'border-slate-300'
                        )}
                        style={{
                          backgroundColor: selectedAgents.includes(agent.agent_id)
                            ? CHART_COLORS[selectedAgents.indexOf(agent.agent_id)]
                            : undefined,
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{agent.agent_name}</TableCell>
                    <TableCell className="text-right">
                      {agent.policies_created_month}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(agent.total_premium)}
                    </TableCell>
                    <TableCell className="text-right">
                      {agent.close_rate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(agent.commissions_earned_month)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Radar Chart */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Comparativo de Agentes</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedAgents.length === 0 ? (
            <div className="flex items-center justify-center h-80 text-muted-foreground">
              <p>Selecciona agentes de la tabla para comparar</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                {selectedAgents.map((agentId, index) => {
                  const agent = data.find((a) => a.agent_id === agentId);
                  if (!agent) return null;
                  return (
                    <Radar
                      key={agentId}
                      name={agent.agent_name}
                      dataKey={agent.agent_name}
                      stroke={CHART_COLORS[index]}
                      fill={CHART_COLORS[index]}
                      fillOpacity={0.2}
                    />
                  );
                })}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentPerformanceTable;
