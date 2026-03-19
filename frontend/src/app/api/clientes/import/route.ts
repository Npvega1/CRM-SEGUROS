import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schema for CSV import row
const CSVRowSchema = z.object({
  full_name: z.string().min(2, 'Nombre requerido'),
  doc_type: z.enum(['cedula', 'nit', 'pasaporte', 'extranjeria']).optional().default('cedula'),
  doc_number: z.string().min(1, 'Documento requerido'),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  segment: z.enum(['individual', 'empresa', 'vip']).optional().default('individual'),
  tags: z.string().optional().nullable(),
});

type CSVRowError = {
  row: number;
  field: string;
  message: string;
  value?: string;
};

// POST /api/clientes/import - Importar clientes desde CSV
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const rows = body.rows as Array<Record<string, unknown>>;
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron filas para importar' },
        { status: 400 }
      );
    }

    const errors: CSVRowError[] = [];
    const validClients: Array<{
      tenant_id: string;
      full_name: string;
      doc_type: string;
      doc_number: string;
      email?: string | null;
      phone?: string | null;
      segment: string;
      tags?: string[];
    }> = [];

    // Validate each row
    rows.forEach((row, index) => {
      const rowNum = index + 2; // +2 because row 1 is header, and we're 0-indexed
      
      const result = CSVRowSchema.safeParse(row);
      
      if (!result.success) {
        result.error.issues.forEach(issue => {
          errors.push({
            row: rowNum,
            field: issue.path.join('.'),
            message: issue.message,
            value: String(row[issue.path[0] as string] || ''),
          });
        });
      } else {
        validClients.push({
          tenant_id: tenantId,
          full_name: result.data.full_name,
          doc_type: result.data.doc_type,
          doc_number: result.data.doc_number,
          email: result.data.email || null,
          phone: result.data.phone || null,
          segment: result.data.segment,
          tags: result.data.tags ? result.data.tags.split(',').map(t => t.trim()) : [],
        });
      }
    });

    // Insert valid clients
    let successCount = 0;
    
    if (validClients.length > 0) {
      // Insert in batches of 50
      const batchSize = 50;
      for (let i = 0; i < validClients.length; i += batchSize) {
        const batch = validClients.slice(i, i + batchSize);
        
        const { error: insertError, data: insertedData } = await supabase
          .from('clients')
          .insert(batch as never[])
          .select();
        
        if (insertError) {
          // If duplicate key error, try inserting one by one
          if (insertError.code === '23505') {
            for (const client of batch) {
              const { error: singleError } = await supabase
                .from('clients')
                .insert(client as never)
                .select();
              
              if (singleError) {
                const rowIndex = validClients.indexOf(client);
                errors.push({
                  row: rowIndex + 2,
                  field: 'doc_number',
                  message: 'Cliente duplicado o documento ya existe',
                  value: client.doc_number,
                });
              } else {
                successCount++;
              }
            }
          } else {
            errors.push({
              row: 0,
              field: '',
              message: `Error de base de datos: ${insertError.message}`,
            });
          }
        } else {
          successCount += insertedData?.length || 0;
        }
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: rows.length - successCount,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
