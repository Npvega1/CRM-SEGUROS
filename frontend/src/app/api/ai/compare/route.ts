// =====================================================
// API Route: Procesar Comparativo/Cotización con Gemini
// Utiliza la capacidad multimodal de Gemini para analizar PDFs
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

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
      console.error('[Supabase] Update failed:', await response.text());
    } else {
      console.log('[Supabase] Update successful, status:', status);
    }
  } catch (error) {
    console.error('[Supabase] Error:', error);
  }
}

// Función para extraer el base64 limpio
function cleanBase64(base64Content: string): string {
  // Remover el prefijo data:application/pdf;base64, si existe
  if (base64Content.includes(',')) {
    return base64Content.split(',')[1];
  }
  return base64Content;
}

// Función para obtener el MIME type correcto
function getMimeType(fileType: string): string {
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg'
  };
  return mimeTypes[fileType.toLowerCase()] || 'application/octet-stream';
}

export async function POST(request: NextRequest) {
  console.log('='.repeat(60));
  console.log('[AI Compare] Request received at', new Date().toISOString());
  
  let comparisonId = '';
  let supabaseUrl = '';
  let supabaseKey = '';
  
  try {
    // Parsear body
    const body: CompareRequest = await request.json();
    comparisonId = body.comparisonId;
    supabaseUrl = body.supabaseUrl || '';
    supabaseKey = body.supabaseKey || '';
    
    console.log('[AI Compare] ComparisonId:', comparisonId);
    console.log('[AI Compare] Line:', body.line);
    console.log('[AI Compare] Operation type:', body.operation_type);
    console.log('[AI Compare] Files count:', body.files?.length || 0);
    
    // Verificar API key - Soporta tanto EMERGENT_LLM_KEY como GOOGLE_GEMINI_API_KEY
    const apiKey = process.env.EMERGENT_LLM_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('[AI Compare] ERROR: No API key configured');
      throw new Error('No hay API key configurada. Agrega EMERGENT_LLM_KEY o GOOGLE_GEMINI_API_KEY en las variables de entorno.');
    }
    
    console.log('[AI Compare] API Key found (length):', apiKey.length);
    console.log('[AI Compare] Using key type:', process.env.EMERGENT_LLM_KEY ? 'EMERGENT_LLM_KEY' : 'GOOGLE_GEMINI_API_KEY');
    
    // Verificar archivos
    if (!body.files || body.files.length === 0) {
      throw new Error('No se recibieron archivos para procesar');
    }
    
    // Determinar si es cotización o comparativo
    const isQuotation = body.operation_type === 'quotation';
    console.log('[AI Compare] Is quotation:', isQuotation);
    
    // Preparar partes para Gemini (multimodal)
    const parts: Part[] = [];
    
    // Agregar instrucciones como texto
    if (isQuotation) {
      parts.push({
        text: `Eres un experto en seguros y fianzas colombiano. Analiza el siguiente documento del ramo "${body.line}" y genera una cotización estructurada.

INSTRUCCIONES:
1. Extrae toda la información relevante del documento
2. Identifica: partes involucradas, montos, plazos, objeto del contrato
3. Genera una estructura de cotización basada en la información extraída

RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO (sin markdown, sin \`\`\`, solo el JSON):
{
  "tipo_documento": "Contrato/Solicitud/Otro",
  "datos_extraidos": {
    "contratante": "Nombre del contratante",
    "beneficiario": "Nombre del beneficiario (si aplica)",
    "objeto": "Descripción del objeto o servicio",
    "valor_contrato": "$X,XXX,XXX",
    "plazo": "X meses/años",
    "ubicacion": "Ciudad/Departamento"
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
}

DOCUMENTO A ANALIZAR:`
      });
    } else {
      parts.push({
        text: `Eres un experto analista de seguros colombiano. Analiza las siguientes ${body.files.length} cotizaciones del ramo "${body.line}" y genera un cuadro comparativo CONSOLIDADO.

INSTRUCCIONES:
1. Extrae la información clave de cada cotización
2. Identifica: aseguradora, coberturas, valores, primas, deducibles
3. Genera una comparativa estructurada

RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO (sin markdown, sin \`\`\`, solo el JSON):
{
  "insurers": [
    {
      "name": "NOMBRE ASEGURADORA",
      "valores_asegurados": [
        {"concepto": "Concepto 1", "valor": "$XXX"}
      ],
      "amparos": [
        {"amparo": "Nombre cobertura", "limite": "100%"}
      ],
      "deducibles": [
        {"concepto": "Tipo deducible", "valor": "X%"}
      ],
      "beneficios": ["Beneficio 1", "Beneficio 2"],
      "prima": {
        "prima_neta": "$X,XXX",
        "iva": "$XXX",
        "total_anual": "$X,XXX"
      }
    }
  ]
}

COTIZACIONES A COMPARAR:`
      });
    }
    
    // Agregar cada archivo como parte inline_data
    for (const file of body.files) {
      console.log('[AI Compare] Processing file:', file.name, 'type:', file.file_type);
      
      const cleanedBase64 = cleanBase64(file.base64_content);
      const mimeType = getMimeType(file.file_type);
      
      // Agregar nombre del archivo como contexto
      parts.push({
        text: `\n--- Archivo: ${file.name} ---`
      });
      
      // Agregar el archivo como inline_data
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanedBase64
        }
      });
    }
    
    console.log('[AI Compare] Total parts prepared:', parts.length);
    
    // Inicializar Gemini
    console.log('[AI Compare] Initializing Gemini...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Usar gemini-2.5-flash (modelo recomendado con Emergent Universal Key)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2, // Respuestas más consistentes
        maxOutputTokens: 4096
      }
    });
    
    console.log('[AI Compare] Calling Gemini API...');
    const startTime = Date.now();
    
    const result = await model.generateContent(parts);
    const response = result.response;
    const responseText = response.text();
    
    const duration = Date.now() - startTime;
    console.log('[AI Compare] Gemini response received in', duration, 'ms');
    console.log('[AI Compare] Response length:', responseText.length);
    console.log('[AI Compare] Response preview:', responseText.substring(0, 200));
    
    // Parsear respuesta JSON
    let parsedData;
    try {
      let cleanResponse = responseText.trim();
      
      // Remover markdown si existe
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.slice(7);
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      cleanResponse = cleanResponse.trim();
      
      console.log('[AI Compare] Attempting to parse JSON...');
      parsedData = JSON.parse(cleanResponse);
      console.log('[AI Compare] JSON parsed successfully');
    } catch (parseError) {
      console.error('[AI Compare] JSON parse error:', parseError);
      console.error('[AI Compare] Raw response:', responseText.substring(0, 1000));
      throw new Error('La IA no devolvió un JSON válido. Por favor intente de nuevo.');
    }
    
    // Construir resultado
    const comparisonTable = isQuotation
      ? { line: body.line, type: 'quotation', quotation: parsedData }
      : { line: body.line, type: 'comparison', insurers: parsedData.insurers || [] };
    
    console.log('[AI Compare] Comparison table built successfully');
    
    // Actualizar Supabase con éxito
    if (supabaseUrl && supabaseKey) {
      await updateSupabase(supabaseUrl, supabaseKey, comparisonId, 'completed', {
        comparison_table: comparisonTable,
        processed_at: new Date().toISOString()
      });
    }
    
    console.log('[AI Compare] SUCCESS - Returning response');
    console.log('='.repeat(60));
    
    return NextResponse.json({
      success: true,
      comparison_table: comparisonTable
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[AI Compare] ERROR:', errorMessage);
    console.error('[AI Compare] Full error:', error);
    console.log('='.repeat(60));
    
    // Actualizar Supabase con error
    if (supabaseUrl && supabaseKey && comparisonId) {
      await updateSupabase(supabaseUrl, supabaseKey, comparisonId, 'error', {
        error_message: errorMessage
      });
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export const maxDuration = 60; // Máximo 60 segundos para Vercel Pro
