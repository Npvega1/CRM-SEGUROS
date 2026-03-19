import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ForecastParamsSchema } from '@/lib/validations/pipeline';

// GET /api/pipeline/forecast - Obtener forecast de pipeline
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const paramsResult = ForecastParamsSchema.safeParse({
      period: searchParams.get('period') || 'monthly',
      agent_id: searchParams.get('agent_id') || null,
      months_ahead: parseInt(searchParams.get('months_ahead') || '6')
    });

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: paramsResult.error.issues },
        { status: 400 }
      );
    }

    const params = paramsResult.data;

    // Intentar leer de la vista materializada primero
    let query = supabase
      .from('mv_pipeline_forecast')
      .select('*')
      .eq('tenant_id', tenantId);

    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }

    const { data: forecastData, error: forecastError } = await query;

    // Si la vista materializada no existe o está vacía, calcular en tiempo real
    if (forecastError || !forecastData || forecastData.length === 0) {
      // Calcular forecast directamente de opportunities
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + params.months_ahead);

      let oppQuery = supabase
        .from('opportunities')
        .select(`
          id,
          agent_id,
          stage_id,
          estimated_premium,
          close_probability,
          expected_close_date,
          stage:pipeline_stages(id, name, color)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .not('expected_close_date', 'is', null)
        .gte('expected_close_date', startDate.toISOString().split('T')[0])
        .lte('expected_close_date', endDate.toISOString().split('T')[0]);

      if (params.agent_id) {
        oppQuery = oppQuery.eq('agent_id', params.agent_id);
      }

      const { data: opportunities, error: oppError } = await oppQuery;

      if (oppError) {
        console.error('Error fetching opportunities for forecast:', oppError);
        return NextResponse.json({ error: oppError.message }, { status: 500 });
      }

      // Tipo para las oportunidades del forecast
      interface ForecastOpportunity {
        id: string;
        agent_id: string | null;
        stage_id: string;
        estimated_premium: number;
        close_probability: number;
        expected_close_date: string | null;
        stage: { id: string; name: string; color: string } | null;
      }

      // Agrupar por mes
      const forecastByMonth: Record<string, {
        month: string;
        opportunity_count: number;
        total_premium: number;
        weighted_premium: number;
        by_stage: Record<string, {
          stage_id: string;
          stage_name: string;
          stage_color: string;
          count: number;
          premium: number;
          weighted: number;
        }>;
      }> = {};

      ((opportunities || []) as ForecastOpportunity[]).forEach((opp) => {
        if (!opp.expected_close_date) return;
        
        const date = new Date(opp.expected_close_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const weighted = opp.estimated_premium * (opp.close_probability / 100);
        
        // Extraer datos del stage
        const stage = opp.stage as { id: string; name: string; color: string } | null;
        const stageId = stage?.id || opp.stage_id;
        const stageName = stage?.name || 'Sin etapa';
        const stageColor = stage?.color || '#6B7280';

        if (!forecastByMonth[monthKey]) {
          forecastByMonth[monthKey] = {
            month: monthKey,
            opportunity_count: 0,
            total_premium: 0,
            weighted_premium: 0,
            by_stage: {}
          };
        }

        forecastByMonth[monthKey].opportunity_count += 1;
        forecastByMonth[monthKey].total_premium += opp.estimated_premium;
        forecastByMonth[monthKey].weighted_premium += weighted;

        if (!forecastByMonth[monthKey].by_stage[stageId]) {
          forecastByMonth[monthKey].by_stage[stageId] = {
            stage_id: stageId,
            stage_name: stageName,
            stage_color: stageColor,
            count: 0,
            premium: 0,
            weighted: 0
          };
        }

        forecastByMonth[monthKey].by_stage[stageId].count += 1;
        forecastByMonth[monthKey].by_stage[stageId].premium += opp.estimated_premium;
        forecastByMonth[monthKey].by_stage[stageId].weighted += weighted;
      });

      // Convertir a array ordenado
      const forecast = Object.values(forecastByMonth)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(item => ({
          ...item,
          by_stage: Object.values(item.by_stage)
        }));

      return NextResponse.json({ forecast, source: 'realtime' });
    }

    // Tipo para los datos de la vista materializada
    interface MaterializedForecastItem {
      tenant_id: string;
      agent_id: string | null;
      stage_id: string;
      stage_name: string;
      forecast_month: string;
      opportunity_count: number;
      total_premium: string;
      weighted_premium: string;
      avg_probability: string;
    }

    // Formatear datos de la vista materializada
    const formattedForecast = (forecastData as MaterializedForecastItem[]).map(item => ({
      month: item.forecast_month,
      stage_id: item.stage_id,
      stage_name: item.stage_name,
      agent_id: item.agent_id,
      opportunity_count: item.opportunity_count,
      total_premium: parseFloat(item.total_premium),
      weighted_premium: parseFloat(item.weighted_premium),
      avg_probability: parseFloat(item.avg_probability)
    }));

    return NextResponse.json({ forecast: formattedForecast, source: 'materialized_view' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/pipeline/forecast:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/pipeline/forecast/refresh - Refrescar vista materializada
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userRole = user.app_metadata?.role;
    
    if (!['admin', 'senior_agent'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Llamar a la función para refrescar la vista
    const { error } = await supabase.rpc('refresh_pipeline_forecast');

    if (error) {
      console.error('Error refreshing forecast:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Forecast actualizado' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in POST /api/pipeline/forecast/refresh:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
