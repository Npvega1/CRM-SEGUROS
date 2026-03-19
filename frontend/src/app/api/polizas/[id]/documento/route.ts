import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/polizas/[id]/documento - Subir documento de póliza
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: policyId } = await params;

    // Verificar que la póliza existe y pertenece al tenant
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select('id')
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .single();

    if (policyError || !policy) {
      return NextResponse.json({ error: 'Póliza no encontrada' }, { status: 404 });
    }

    // Get the file from the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10MB' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${tenantId}/${policyId}/${timestamp}_${file.name}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('policy-documents')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 });
    }

    // Update policy with document URL
    const { error: updateError } = await supabase
      .from('policies')
      .update({ document_url: fileName } as never)
      .eq('id', policyId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Error al actualizar la póliza' }, { status: 500 });
    }

    return NextResponse.json({ url: fileName });
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/polizas/[id]/documento - Obtener URL firmada del documento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: policyId } = await params;

    // Get policy with document URL
    const { data: policy, error: policyError } = await supabase
      .from('policies')
      .select('document_url')
      .eq('id', policyId)
      .eq('tenant_id', tenantId)
      .single();

    if (policyError || !policy) {
      return NextResponse.json({ error: 'Póliza no encontrada' }, { status: 404 });
    }

    if (!policy.document_url) {
      return NextResponse.json({ error: 'La póliza no tiene documento adjunto' }, { status: 404 });
    }

    // Get signed URL
    const { data: signedUrl, error: signError } = await supabase.storage
      .from('policy-documents')
      .createSignedUrl(policy.document_url, 3600); // 1 hour expiry

    if (signError) {
      console.error('Sign error:', signError);
      return NextResponse.json({ error: 'Error al generar URL del documento' }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl.signedUrl });
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
