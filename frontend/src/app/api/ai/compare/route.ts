// =====================================================
// API Route: Procesar Comparativo/Cotización con Gemini
// Funciona completamente en Vercel (sin backend externo)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Tipos
interface FileData {
  name: string;
  file_type: string;
  base64_content: string;
}

interface CompareRequest {
  comparisonId: string;
  tenantId: string;
  line: string;
  files: FileData[];
  criteria: string[];
  operation_type?: 'comparison' | 'quotation';
  supabaseUrl?: string;
  supabaseKey?: string;
}

// Función para extraer texto de base64 PDF (simplificado)
async function extractTextFromPDF(base64Content: string): Promise<string> {
  try {
    // Remover prefijo data:application/pdf;base64, si existe
    const base64Data = base64Content.includes(',') 
      ? base64Content.split(',')[1] 
      : base64Content;
    
    // Convertir base64 a buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Usar pdf-parse para extraer texto
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    
    return data.text || '';
  } catch (error) {
    console.error('Error extracting PDF:', error);
    return '';
  }
}

// Función para actualizar Supabase
async function updateSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  comparisonId: string,
  status: string,
  data: Record<string, unknown>
) {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/comparisons?id=eq.${comparisonId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status,
          ...data,
          updated_at: new Date().toISOString()
        })
      }
    );
    
    if (!response.ok) {
      console.error('Supabase update failed:', await response.text());
    }
  } catch (error) {
    console.error('Error updating Supabase:', error);
  }
}

export async function POST(request: NextRequest) {
  let comparisonId = '';
  let supabaseUrl = '';
  let supabaseKey = '';
  
  try {
    const body: CompareRequest = await request.json();
    comparisonId = body.comparisonId;
    supabaseUrl = body.supabaseUrl || '';
    supabaseKey = body.supabaseKey || '';
    
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY no configurada');
    }
    
    // Extraer texto de cada archivo
    const extractedTexts: Array<{ name: string; content: string }> = [];
    
    for (const file of body.files) {
      let text = '';
      
      if (file.file_type === 'pdf') {
        text = await extractTextFromPDF(file.base64_content);
      }
      
      if (text.trim()) {
        extractedTexts.push({
          name: file.name,
          content: text.substring(0, 8000) // Limitar tamaño
        });
      }
    }
    
    if (extractedTexts.length === 0) {
      throw new Error('No se pudo extraer texto de los archivos');
    }
    
    // Determinar si es cotización o comparativo
    const isQuotation = body.operation_type === 'quotation';
    
    // Construir el prompt según el tipo
    let prompt = '';
    
    if (isQuotation) {
      // PROMPT PARA COTIZACIÓN (1 archivo)
      const doc = extractedTexts[0];
      prompt = `Eres un experto en seguros y fianzas colombiano. Analiza este documento del ramo "${body.line}" y genera una cotización estructurada.

${'='.repeat(60)}
DOCUMENTO: ${doc.name}
${'='.repeat(60)}
${doc.content}

INSTRUCCIONES:
1. Extrae toda la información relevante del documento (contrato, solicitud, etc.)
2. Identifica: partes involucradas, montos, plazos, objeto del contrato
3. Genera una estructura de cotización basada en la información extraída

RESPONDE SOLO CON JSON VÁLIDO:
{
  "tipo_documento": "Contrato/Solicitud/Otro",
  "datos_extraidos": {
    "contratante": "Nombre del contratante",
    "beneficiario": "Nombre del beneficiario (si aplica)",
    "objeto": "Descripción del objeto o servicio",
    "valor_contrato": "$X,XXX,XXX",
    "plazo": "X meses/años",
    "ubicacion": "Ciudad/Departamento",
    "fecha_inicio": "DD/MM/AAAA",
    "fecha_fin": "DD/MM/AAAA"
  },
  "cotizacion_sugerida": {
    "tipo_fianza": "Cumplimiento/Anticipo/Calidad/etc.",
    "valor_asegurado": "$X,XXX,XXX",
    "vigencia": "X meses",
    "tasa_estimada": "X.X%",
    "prima_estimada": "$X,XXX,XXX",
    "requisitos": ["Requisito 1", "Requisito 2"],
    "observaciones": "Notas adicionales"
  }
}`;
    } else {
      // PROMPT PARA COMPARATIVO (2+ archivos)
      let filesContent = '';
      extractedTexts.forEach((doc, i) => {
        filesContent += `\n\n${'='.repeat(60)}\nCOTIZACIÓN ${i + 1}: ${doc.name}\n${'='.repeat(60)}\n${doc.content}\n`;
      });
      
      prompt = `Eres un experto analista de seguros colombiano. Analiza estas ${extractedTexts.length} cotizaciones del ramo "${body.line}" y crea UN cuadro comparativo CONSOLIDADO.

${filesContent}

RESPONDE SOLO CON JSON VÁLIDO:
{
  "insurers": [
    {
      "name": "NOMBRE ASEGURADORA",
      "valores_asegurados": [
        {"concepto": "Edificio", "valor": "$600,000,000"},
        {"concepto": "Contenidos", "valor": "$50,000,000"},
        {"concepto": "TOTAL ASEGURADO", "valor": "$650,000,000"}
      ],
      "amparos": [
        {"amparo": "Incendio y Rayo", "limite": "100%"},
        {"amparo": "Terremoto", "limite": "100%"},
        {"amparo": "Hurto Calificado", "limite": "$30,000,000"}
      ],
      "deducibles": [
        {"concepto": "Incendio/Básico", "valor": "0.5% del valor de la pérdida"},
        {"concepto": "Terremoto", "valor": "3% valor asegurado, mín 1 SMMLV"}
      ],
      "beneficios": ["Asistencia domiciliaria 24/7", "Hospedaje temporal"],
      "prima": {
        "prima_neta": "$1,000,000",
        "iva": "$190,000",
        "total_anual": "$1,190,000",
        "forma_pago": "Anual o cuotas"
      }
    }
  ]
}`;
    }
    
    // Llamar a Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parsear respuesta JSON
    let parsedData;
    try {
      let cleanResponse = responseText.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.split('```')[1];
        if (cleanResponse.startsWith('json')) {
          cleanResponse = cleanResponse.substring(4);
        }
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      parsedData = JSON.parse(cleanResponse.trim());
    } catch {
      console.error('Error parsing JSON:', responseText.substring(0, 500));
      throw new Error('Error al parsear respuesta de IA');
    }
    
    // Construir resultado
    const comparisonTable = isQuotation
      ? { line: body.line, type: 'quotation', quotation: parsedData }
      : { line: body.line, type: 'comparison', insurers: parsedData.insurers || [] };
    
    // Actualizar Supabase con éxito
    if (supabaseUrl && supabaseKey) {
      await updateSupabase(supabaseUrl, supabaseKey, comparisonId, 'completed', {
        comparison_table: comparisonTable,
        processed_at: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      success: true,
      comparison_table: comparisonTable
    });
    
  } catch (error) {
    console.error('Error processing:', error);
    
    // Actualizar Supabase con error
    if (supabaseUrl && supabaseKey && comparisonId) {
      await updateSupabase(supabaseUrl, supabaseKey, comparisonId, 'error', {
        error_message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

export const maxDuration = 60; // Máximo 60 segundos
