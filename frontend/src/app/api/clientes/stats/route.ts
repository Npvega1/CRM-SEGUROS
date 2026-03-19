import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/clientes/stats - Obtener estadísticas de clientes
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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Obtener todos los clientes activos con solo los campos necesarios
    const { data, error } = await supabase
      .from('clients')
      .select('segment, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clients = data || [];
    const total = clients.length;

    // Calcular stats en memoria
    const bySegment: Record<string, number> = {
      individual: 0,
      empresa: 0,
      vip: 0
    };

    let thisMonth = 0;
    const startOfMonthTime = startOfMonth.getTime();

    clients.forEach((client: { segment?: string; created_at?: string }) => {
      // Contar por segmento
      if (client.segment && bySegment[client.segment] !== undefined) {
        bySegment[client.segment]++;
      }

      // Contar este mes
      if (client.created_at) {
        const createdDate = new Date(client.created_at);
        if (createdDate.getTime() >= startOfMonthTime) {
          thisMonth++;
        }
      }
    });

    return NextResponse.json({
      total,
      bySegment,
      thisMonth
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
