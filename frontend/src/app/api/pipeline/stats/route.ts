import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/pipeline/stats - Obtener estadísticas del pipeline
export async function GET() {
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

    // Obtener estadísticas de oportunidades activas
    const { data: activeOpps, error: activeError } = await supabase
      .from('opportunities')
      .select('id, estimated_premium, close_probability')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (activeError) {
      console.error('Error fetching active opportunities:', activeError);
      return NextResponse.json({ error: activeError.message }, { status: 500 });
    }

    // Tipo para oportunidades de estadísticas
    interface StatsOpportunity {
      id: string;
      estimated_premium: number;
      close_probability: number;
    }

    const typedActiveOpps = (activeOpps || []) as StatsOpportunity[];

    // Calcular métricas
    const totalActive = typedActiveOpps.length;
    const totalPremium = typedActiveOpps.reduce((sum, opp) => sum + opp.estimated_premium, 0);
    const weightedPremium = typedActiveOpps.reduce(
      (sum, opp) => sum + (opp.estimated_premium * opp.close_probability / 100), 
      0
    );

    // Obtener oportunidades ganadas y perdidas del mes actual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: wonOpps } = await supabase
      .from('opportunities')
      .select('id, estimated_premium')
      .eq('tenant_id', tenantId)
      .eq('status', 'won')
      .gte('updated_at', startOfMonth.toISOString());

    const { data: lostOpps } = await supabase
      .from('opportunities')
      .select('id, estimated_premium')
      .eq('tenant_id', tenantId)
      .eq('status', 'lost')
      .gte('updated_at', startOfMonth.toISOString());

    const wonCount = (wonOpps || []).length;
    const lostCount = (lostOpps || []).length;
    const typedWonOpps = (wonOpps || []) as { id: string; estimated_premium: number }[];
    const wonPremium = typedWonOpps.reduce((sum, opp) => sum + opp.estimated_premium, 0);

    // Calcular tasa de conversión del mes
    const closedCount = wonCount + lostCount;
    const conversionRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;

    // Obtener forecast del mes actual
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);

    const { data: monthForecast } = await supabase
      .from('opportunities')
      .select('id, estimated_premium, close_probability')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gte('expected_close_date', startOfMonth.toISOString().split('T')[0])
      .lte('expected_close_date', endOfMonth.toISOString().split('T')[0]);

    const typedMonthForecast = (monthForecast || []) as StatsOpportunity[];
    const monthForecastWeighted = typedMonthForecast.reduce(
      (sum, opp) => sum + (opp.estimated_premium * opp.close_probability / 100),
      0
    ) || 0;

    return NextResponse.json({
      stats: {
        total_active: totalActive,
        total_premium: totalPremium,
        weighted_premium: weightedPremium,
        won_this_month: wonCount,
        lost_this_month: lostCount,
        won_premium_this_month: wonPremium,
        conversion_rate: conversionRate,
        month_forecast: monthForecastWeighted
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/pipeline/stats:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
