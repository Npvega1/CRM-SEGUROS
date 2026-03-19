import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateClientInputSchema } from '@/lib/validations/clients';

// GET /api/clientes - Listar clientes
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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || undefined;
    const segment = searchParams.get('segment') || undefined;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (segment) {
      query = query.eq('segment', segment);
    }
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,doc_number.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      clients: data || [],
      total: count || 0
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/clientes - Crear cliente
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/clientes - Starting');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('POST /api/clientes - User:', user?.id, 'Auth Error:', authError?.message);
    
    if (!user) {
      console.log('POST /api/clientes - No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = user.app_metadata?.tenant_id;
    console.log('POST /api/clientes - Tenant ID:', tenantId);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = CreateClientInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        full_name: validatedData.full_name,
        doc_type: validatedData.doc_type,
        doc_number: validatedData.doc_number,
        email: validatedData.email,
        phone: validatedData.phone,
        segment: validatedData.segment,
        agent_id: validatedData.agent_id,
        tags: validatedData.tags,
        metadata: validatedData.metadata
      } as never)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe un cliente con este número de documento' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
