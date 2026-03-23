import { NextRequest, NextResponse } from 'next/server';

// Interfaces
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
}

interface InsurerField {
  value: string;
  notes?: string;
}

interface InsurerData {
  name: string;
  fields: Record<string, InsurerField>;
}

// Simple text extraction from PDF
function extractTextFromPDF(base64Content: string): string {
  try {
    let cleanBase64 = base64Content;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    
    const binaryString = atob(cleanBase64);
    const textMatches: string[] = [];
    
    // Find readable ASCII text sequences
    const readablePattern = /[\x20-\x7E\xC0-\xFF]{15,}/g;
    const matches = binaryString.match(readablePattern) || [];
    
    for (const match of matches) {
      // Filter out PDF structure keywords
      if (!match.includes('stream') && 
          !match.includes('endobj') && 
          !match.includes('xref') &&
          !match.includes('/Type') &&
          !match.includes('/Filter') &&
          !match.includes('trailer') &&
          !match.includes('startxref')) {
        textMatches.push(match);
      }
    }
    
    return textMatches.join(' ').slice(0, 12000);
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '';
  }
}

// Call Gemini via Emergent proxy
async function callGeminiViaEmergent(apiKey: string, prompt: string, systemPrompt: string): Promise<string> {
  // Use the emergent integrations endpoint
  const response = await fetch('https://api.emergentmethods.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Emergent API error:', response.status, errorText);
    throw new Error(`API error: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  try {
    const body: CompareRequest = await request.json();
    const { comparisonId, line, files, criteria } = body;

    // Get API key
    const apiKey = process.env.EMERGENT_LLM_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    console.log('Processing comparison:', comparisonId);
    console.log('Files:', files.map(f => f.name));

    // Extract text from files
    const extractedTexts: { name: string; content: string }[] = [];

    for (const file of files) {
      const text = extractTextFromPDF(file.base64_content);
      
      if (text.trim().length > 50) {
        extractedTexts.push({ name: file.name, content: text });
        console.log(`Extracted ${text.length} chars from ${file.name}`);
      } else {
        console.log(`Warning: Little text extracted from ${file.name}`);
      }
    }

    if (extractedTexts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo extraer texto de los archivos. Los PDFs pueden ser imágenes escaneadas.'
      });
    }

    // Build prompt
    const criteriaList = criteria.map(c => `- ${c}`).join('\n');
    
    let filesContent = '';
    for (let i = 0; i < extractedTexts.length; i++) {
      filesContent += `\n\n=== COTIZACIÓN ${i + 1}: ${extractedTexts[i].name} ===\n${extractedTexts[i].content}\n`;
    }

    const analysisPrompt = `Analiza las siguientes ${extractedTexts.length} cotizaciones de seguro de ramo "${line}".

${filesContent}

Para cada cotización, extrae la siguiente información:
${criteriaList}

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "insurers": [
    {
      "name": "Nombre de la aseguradora",
      "fields": {
        "NombreCriterio1": {"value": "valor extraído", "notes": "observaciones opcionales"},
        "NombreCriterio2": {"value": "valor extraído", "notes": "observaciones opcionales"}
      }
    }
  ]
}

Importante:
- Extrae el nombre de la aseguradora de cada documento
- Si un valor no está disponible, usa "No especificado"
- Los valores numéricos deben incluir la moneda cuando aplique
- NO incluyas texto fuera del JSON`;

    console.log('Calling Gemini API...');
    
    const responseText = await callGeminiViaEmergent(
      apiKey,
      analysisPrompt,
      'Eres un experto analista de seguros. Analiza cotizaciones y extrae información estructurada. Responde SOLO con JSON válido, sin markdown ni texto adicional.'
    );

    console.log('Gemini response length:', responseText.length);

    // Parse JSON response
    let cleanResponse = responseText.trim();
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.split('```')[1];
      if (cleanResponse.startsWith('json')) {
        cleanResponse = cleanResponse.slice(4);
      }
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3);
    }

    let comparisonData: { insurers: InsurerData[] };
    try {
      comparisonData = JSON.parse(cleanResponse.trim());
    } catch (parseError) {
      console.error('Failed to parse:', responseText.slice(0, 500));
      return NextResponse.json({
        success: false,
        error: 'Error al parsear respuesta de IA'
      });
    }

    // Build comparison table
    const comparisonTable = {
      criteria: criteria,
      insurers: comparisonData.insurers || []
    };

    // Generate recommendation
    const recommendationPrompt = `Basándote en este análisis comparativo de cotizaciones de seguro:

${JSON.stringify(comparisonTable, null, 2)}

Genera una recomendación concisa (máximo 3 párrafos) para el cliente:
1. Cuál cotización ofrece mejor relación costo-beneficio
2. Puntos fuertes y débiles de cada opción
3. Recomendación final

Sé objetivo y profesional. Solo texto plano, sin markdown.`;

    let recommendation = 'No se pudo generar la recomendación.';
    try {
      recommendation = await callGeminiViaEmergent(
        apiKey,
        recommendationPrompt,
        'Eres un asesor de seguros experto. Da recomendaciones claras y objetivas.'
      );
    } catch (recError) {
      console.error('Recommendation error:', recError);
    }

    console.log('Comparison completed successfully');

    return NextResponse.json({
      success: true,
      comparison_table: comparisonTable,
      ai_recommendation: recommendation
    });

  } catch (error) {
    console.error('Error in AI comparison:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
