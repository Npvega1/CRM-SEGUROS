'use client';

// =====================================================
// PÁGINA: Pipeline de Ventas
// Módulo 02: Vista principal del Kanban
// =====================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  TrendingUp, 
  DollarSign, 
  Target, 
  RefreshCw,
  LayoutGrid,
  BarChart3
} from 'lucide-react';
import {
  KanbanBoard,
  KanbanBoardSkeleton,
  OpportunityDrawer,
  ForecastChart,
  CreateOpportunityForm
} from '@/components/modules/pipeline';
import type { 
  PipelineStage, 
  OpportunityWithRelations,
  Activity,
  CreateOpportunityInput,
  CreateActivityInput
} from '@/lib/validations/pipeline';
import { formatPremium } from '@/lib/validations/pipeline';

interface PipelineStats {
  total_active: number;
  total_premium: number;
  weighted_premium: number;
  won_this_month: number;
  lost_this_month: number;
  won_premium_this_month: number;
  conversion_rate: number;
  month_forecast: number;
}

interface ForecastData {
  month: string;
  opportunity_count: number;
  total_premium: number;
  weighted_premium: number;
}

export default function PipelinePage() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const supabase = useMemo(() => createClient(), []);

  // Estados
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityWithRelations[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drawer y modales
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityWithRelations | null>(null);
  const [opportunityActivities, setOpportunityActivities] = useState<Activity[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Vista activa
  const [activeView, setActiveView] = useState<'kanban' | 'forecast'>('kanban');

  // Cargar datos
  const loadData = useCallback(async () => {
    if (!tenantId) return;

    try {
      setIsLoading(true);

      // Cargar etapas, oportunidades y estadísticas en paralelo
      const [stagesRes, oppsRes, statsRes, forecastRes] = await Promise.all([
        fetch('/api/pipeline/stages'),
        fetch('/api/pipeline/opportunities?status=active'),
        fetch('/api/pipeline/stats'),
        fetch('/api/pipeline/forecast?months_ahead=6')
      ]);

      if (stagesRes.ok) {
        const data = await stagesRes.json();
        setStages(data.stages || []);
      }

      if (oppsRes.ok) {
        const data = await oppsRes.json();
        setOpportunities(data.opportunities || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      if (forecastRes.ok) {
        const data = await forecastRes.json();
        setForecast(data.forecast || []);
      }
    } catch (error) {
      console.error('Error loading pipeline data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Cargar al montar
  useEffect(() => {
    // Cargar datos cuando tenemos tenantId o cuando termine de cargar el tenant
    if (!tenantLoading) {
      loadData();
    }
  }, [tenantLoading, loadData]);

  // Suscribirse a Realtime
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('pipeline-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'opportunities',
          filter: `tenant_id=eq.${tenantId}`
        },
        () => {
          // Recargar oportunidades cuando hay cambios
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, supabase, loadData]);

  // Handlers
  const handleMoveOpportunity = async (opportunityId: string, newStageId: string) => {
    try {
      const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', new_stage_id: newStageId })
      });

      if (response.ok) {
        const updatedOpp = await response.json();
        setOpportunities(prev => 
          prev.map(opp => opp.id === opportunityId ? updatedOpp : opp)
        );
      }
    } catch (error) {
      console.error('Error moving opportunity:', error);
    }
  };

  const handleWinOpportunity = async (
    opportunityId: string, 
    data: { policy_number?: string; commission_pct?: number }
  ) => {
    const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'win', ...data })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al ganar oportunidad');
    }

    // Remover de la lista activa
    setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    
    // Recargar estadísticas
    const statsRes = await fetch('/api/pipeline/stats');
    if (statsRes.ok) {
      const data = await statsRes.json();
      setStats(data.stats);
    }
  };

  const handleLoseOpportunity = async (opportunityId: string, reason: string) => {
    const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lose', lost_reason: reason })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al perder oportunidad');
    }

    // Remover de la lista activa
    setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    
    // Recargar estadísticas
    const statsRes = await fetch('/api/pipeline/stats');
    if (statsRes.ok) {
      const data = await statsRes.json();
      setStats(data.stats);
    }
  };

  const handleOpportunityClick = async (opportunity: OpportunityWithRelations) => {
    setSelectedOpportunity(opportunity);
    
    // Cargar actividades
    const response = await fetch(`/api/pipeline/activities?opportunity_id=${opportunity.id}`);
    if (response.ok) {
      const data = await response.json();
      setOpportunityActivities(data.activities || []);
    }
  };

  const handleUpdateOpportunity = async (id: string, data: Partial<OpportunityWithRelations>) => {
    const response = await fetch(`/api/pipeline/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al actualizar');
    }

    const updatedOpp = await response.json();
    setOpportunities(prev => 
      prev.map(opp => opp.id === id ? updatedOpp : opp)
    );
    setSelectedOpportunity(updatedOpp);
  };

  const handleCreateActivity = async (data: CreateActivityInput) => {
    const response = await fetch('/api/pipeline/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al crear actividad');
    }

    const newActivity = await response.json();
    setOpportunityActivities(prev => [newActivity, ...prev]);
  };

  const handleCompleteActivity = async (activityId: string) => {
    const response = await fetch('/api/pipeline/activities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        activity_id: activityId, 
        completed_at: new Date().toISOString() 
      })
    });

    if (response.ok) {
      const updatedActivity = await response.json();
      setOpportunityActivities(prev => 
        prev.map(act => act.id === activityId ? updatedActivity : act)
      );
    }
  };

  const handleCreateOpportunity = async (data: CreateOpportunityInput) => {
    const response = await fetch('/api/pipeline/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al crear oportunidad');
    }

    const newOpp = await response.json();
    setOpportunities(prev => [newOpp, ...prev]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  if (tenantLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Pipeline de Ventas</h1>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-8 bg-muted rounded w-20 mb-2"></div>
                <div className="h-4 bg-muted rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <KanbanBoardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="pipeline-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline de Ventas</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona tus oportunidades de venta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="refresh-pipeline-btn"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowCreateForm(true)} data-testid="new-opportunity-btn">
            <Plus className="h-4 w-4 mr-1" />
            Nueva Oportunidad
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Oportunidades Activas</span>
            </div>
            <p className="text-2xl font-bold" data-testid="total-opportunities">
              {stats?.total_active || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Prima Total</span>
            </div>
            <p className="text-2xl font-bold" data-testid="total-premium">
              {formatPremium(stats?.total_premium || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Prima Ponderada</span>
            </div>
            <p className="text-2xl font-bold text-primary" data-testid="weighted-premium">
              {formatPremium(stats?.weighted_premium || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Ganadas Este Mes</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-green-600">
                {stats?.won_this_month || 0}
              </p>
              {stats?.conversion_rate !== undefined && stats.conversion_rate > 0 && (
                <Badge variant="secondary" className="text-green-600">
                  {stats.conversion_rate.toFixed(0)}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Kanban / Forecast */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'kanban' | 'forecast')}>
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Forecast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard
            stages={stages}
            opportunities={opportunities}
            onMoveOpportunity={handleMoveOpportunity}
            onWinOpportunity={handleWinOpportunity}
            onLoseOpportunity={handleLoseOpportunity}
            onOpportunityClick={handleOpportunityClick}
          />
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <ForecastChart data={forecast} />
        </TabsContent>
      </Tabs>

      {/* Drawer de oportunidad */}
      <OpportunityDrawer
        open={!!selectedOpportunity}
        opportunity={selectedOpportunity}
        stages={stages}
        activities={opportunityActivities}
        onClose={() => {
          setSelectedOpportunity(null);
          setOpportunityActivities([]);
        }}
        onUpdate={handleUpdateOpportunity}
        onCreateActivity={handleCreateActivity}
        onCompleteActivity={handleCompleteActivity}
      />

      {/* Modal crear oportunidad */}
      <CreateOpportunityForm
        open={showCreateForm}
        stages={stages}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateOpportunity}
      />
    </div>
  );
}
