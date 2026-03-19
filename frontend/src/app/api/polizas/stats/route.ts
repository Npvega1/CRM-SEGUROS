import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/polizas/stats - Estadísticas de pólizas
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

    // Obtener todas las pólizas del tenant
    const { data: policies, error } = await supabase
      .from('policies')
      .select('id, status, line, premium')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error fetching policy stats:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allPolicies = policies || [];
    
    // Calcular estadísticas
    const total = allPolicies.length;
    const active = allPolicies.filter(p => p.status === 'activa').length;
    const totalPremium = allPolicies.reduce((sum, p) => sum + (p.premium || 0), 0);
    
    // Agrupar por status
    const byStatus: Record<string, number> = {};
    allPolicies.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });
    
    // Agrupar por line
    const byLine: Record<string, number> = {};
    allPolicies.forEach(p => {
      byLine[p.line] = (byLine[p.line] || 0) + 1;
    });

    // Pólizas que vencen este mes
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const { data: expiringData } = await supabase
      .from('policies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'activa')
      .lte('end_date', endOfMonth.toISOString().split('T')[0])
      .gte('end_date', now.toISOString().split('T')[0]);

    const expiringThisMonth = expiringData?.length || 0;

    return NextResponse.json({
      total,
      active,
      byStatus,
      byLine,
      totalPremium,
      expiringThisMonth
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/polizas/stats:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
