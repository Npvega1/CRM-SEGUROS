import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/polizas/expiring - Pólizas próximas a vencer
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
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from('policies')
      .select(`
        id,
        policy_number,
        insurer,
        line,
        premium,
        end_date,
        client:clients(id, full_name, email, phone)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'activa')
      .gte('end_date', now.toISOString().split('T')[0])
      .lte('end_date', futureDate.toISOString().split('T')[0])
      .order('end_date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching expiring policies:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calcular días restantes
    const policies = (data || []).map(policy => {
      const endDate = new Date(policy.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const client = policy.client as { id: string; full_name: string; email: string | null; phone: string | null } | null;
      
      return {
        id: policy.id,
        policy_number: policy.policy_number,
        insurer: policy.insurer,
        line: policy.line,
        premium: policy.premium,
        end_date: policy.end_date,
        days_remaining: daysRemaining,
        client_id: client?.id,
        client_name: client?.full_name,
        client_email: client?.email,
        client_phone: client?.phone
      };
    });

    return NextResponse.json({ policies });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in GET /api/polizas/expiring:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
