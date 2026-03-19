'use client';

// =====================================================
// PÁGINA: Pipeline de Ventas
// Módulo 02: Vista principal del Kanban
// Usa Supabase Client directo (evita API Routes con problemas de proxy)
// =====================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
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
  const { tenantId, isLoading: tenantLoading, user } = useTenant();
  const supabase = useMemo(() => getBrowserClient(), []);

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

  // Cargar datos usando Supabase directo
  const loadData = useCallback(async () => {
    if (!tenantId) return;

    try {
      setIsLoading(true);

      // Cargar etapas
      const { data: stagesData } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: true });
      
      if (stagesData) {
        setStages(stagesData as PipelineStage[]);
      }

      // Cargar oportunidades activas con relaciones
      const { data: oppsData } = await supabase
        .from('opportunities')
        .select(`
          *,
          clients!inner(id, full_name, email, phone, segment),
          pipeline_stages!inner(id, name, color, order_index)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (oppsData) {
        const mappedOpps = oppsData.map((opp: Record<string, unknown>) => ({
          ...opp,
          client: opp.clients,
          stage: opp.pipeline_stages
        })) as OpportunityWithRelations[];
        setOpportunities(mappedOpps);
      }

      // Calcular estadísticas
      const { data: allOpps } = await supabase
        .from('opportunities')
        .select('status, estimated_premium, probability, won_at, lost_at')
        .eq('tenant_id', tenantId);
      
      if (allOpps) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const activeOpps = allOpps.filter(o => o.status === 'active');
        const wonThisMonth = allOpps.filter(o => 
          o.status === 'won' && o.won_at && new Date(o.won_at) >= startOfMonth
        );
        const lostThisMonth = allOpps.filter(o => 
          o.status === 'lost' && o.lost_at && new Date(o.lost_at) >= startOfMonth
        );
        
        const totalPremium = activeOpps.reduce((sum, o) => sum + (o.estimated_premium || 0), 0);
        const weightedPremium = activeOpps.reduce((sum, o) => 
          sum + ((o.estimated_premium || 0) * (o.probability || 0) / 100), 0
        );
        const wonPremium = wonThisMonth.reduce((sum, o) => sum + (o.estimated_premium || 0), 0);
        
        const totalClosed = wonThisMonth.length + lostThisMonth.length;
        const conversionRate = totalClosed > 0 ? (wonThisMonth.length / totalClosed) * 100 : 0;
        
        setStats({
          total_active: activeOpps.length,
          total_premium: totalPremium,
          weighted_premium: weightedPremium,
          won_this_month: wonThisMonth.length,
          lost_this_month: lostThisMonth.length,
          won_premium_this_month: wonPremium,
          conversion_rate: conversionRate,
          month_forecast: weightedPremium
        });
      }

      // Forecast simple (próximos 6 meses)
      const forecastData: ForecastData[] = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() + i);
        forecastData.push({
          month: date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
          opportunity_count: 0,
          total_premium: 0,
          weighted_premium: 0
        });
      }
      setForecast(forecastData);

    } catch (error) {
      console.error('Error loading pipeline data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, supabase]);

  // Cargar al montar
  useEffect(() => {
    if (!tenantLoading && tenantId) {
      loadData();
    }
  }, [tenantLoading, tenantId, loadData]);

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
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, supabase, loadData]);

  // Handlers usando Supabase directo
  const handleMoveOpportunity = async (opportunityId: string, newStageId: string) => {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
        .eq('id', opportunityId)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          clients!inner(id, full_name, email, phone, segment),
          pipeline_stages!inner(id, name, color, order_index)
        `)
        .single();

      if (!error && data) {
        const updatedOpp = {
          ...data,
          client: data.clients,
          stage: data.pipeline_stages
        } as OpportunityWithRelations;
        
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
    // Llamar a la función PostgreSQL win_opportunity
    const { error } = await supabase.rpc('win_opportunity', {
      p_opportunity_id: opportunityId,
      p_policy_number: data.policy_number || `POL-${Date.now()}`,
      p_commission_pct: data.commission_pct || 10
    });

    if (error) {
      throw new Error(error.message || 'Error al ganar oportunidad');
    }

    // Remover de la lista activa y recargar
    setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    loadData();
  };

  const handleLoseOpportunity = async (opportunityId: string, reason: string) => {
    // Llamar a la función PostgreSQL lose_opportunity
    const { error } = await supabase.rpc('lose_opportunity', {
      p_opportunity_id: opportunityId,
      p_lost_reason: reason
    });

    if (error) {
      throw new Error(error.message || 'Error al perder oportunidad');
    }

    // Remover de la lista activa y recargar
    setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId));
    loadData();
  };

  const handleOpportunityClick = async (opportunity: OpportunityWithRelations) => {
    setSelectedOpportunity(opportunity);
    
    // Cargar actividades
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunity.id)
      .order('created_at', { ascending: false });
    
    setOpportunityActivities((data || []) as Activity[]);
  };

  const handleUpdateOpportunity = async (id: string, updateData: Partial<OpportunityWithRelations>) => {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(`
        *,
        clients!inner(id, full_name, email, phone, segment),
        pipeline_stages!inner(id, name, color, order_index)
      `)
      .single();

    if (error) {
      throw new Error(error.message || 'Error al actualizar');
    }

    const updatedOpp = {
      ...data,
      client: data.clients,
      stage: data.pipeline_stages
    } as OpportunityWithRelations;

    setOpportunities(prev => 
      prev.map(opp => opp.id === id ? updatedOpp : opp)
    );
    setSelectedOpportunity(updatedOpp);
  };

  const handleCreateActivity = async (activityData: CreateActivityInput) => {
    const { data, error } = await supabase
      .from('activities')
      .insert({
        tenant_id: tenantId,
        opportunity_id: activityData.opportunity_id,
        client_id: activityData.client_id,
        agent_id: user?.id,
        type: activityData.type,
        subject: activityData.subject,
        description: activityData.description,
        scheduled_at: activityData.scheduled_at
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Error al crear actividad');
    }

    setOpportunityActivities(prev => [data as Activity, ...prev]);
  };

  const handleCompleteActivity = async (activityId: string) => {
    const { data, error } = await supabase
      .from('activities')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', activityId)
      .select()
      .single();

    if (!error && data) {
      setOpportunityActivities(prev => 
        prev.map(act => act.id === activityId ? (data as Activity) : act)
      );
    }
  };

  const handleCreateOpportunity = async (oppData: CreateOpportunityInput) => {
    // Obtener la primera etapa (default)
    const defaultStage = stages.find(s => s.is_default) || stages[0];
    
    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        tenant_id: tenantId,
        client_id: oppData.client_id,
        stage_id: defaultStage?.id,
        agent_id: user?.id,
        line: oppData.line,
        estimated_premium: oppData.estimated_premium,
        probability: oppData.probability || 50,
        source: oppData.source,
        notes: oppData.notes,
        expected_close_date: oppData.expected_close_date,
        status: 'active'
      })
      .select(`
        *,
        clients!inner(id, full_name, email, phone, segment),
        pipeline_stages!inner(id, name, color, order_index)
      `)
      .single();

    if (error) {
      throw new Error(error.message || 'Error al crear oportunidad');
    }

    const newOpp = {
      ...data,
      client: data.clients,
      stage: data.pipeline_stages
    } as OpportunityWithRelations;

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
