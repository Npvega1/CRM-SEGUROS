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

// Extract text from PDF using pdf-parse (works in Edge/Vercel)
async function extractTextFromPDF(base64Content: string): Promise<string> {
  try {
    // Decode base64
    let cleanBase64 = base64Content;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Simple text extraction from PDF (basic approach)
    // Look for text streams in the PDF
    const text = binaryString;
    const textMatches: string[] = [];
    
    // Find text between BT and ET (text objects in PDF)
    const btPattern = /BT[\s\S]*?ET/g;
    const matches = text.match(btPattern) || [];
    
    for (const match of matches) {
      // Extract text from Tj and TJ operators
      const tjPattern = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjPattern.exec(match)) !== null) {
        textMatches.push(tjMatch[1]);
      }
    }
    
    // Also try to find readable text directly
    const readablePattern = /[\x20-\x7E]{10,}/g;
    const readable = binaryString.match(readablePattern) || [];
    textMatches.push(...readable.filter(t => !t.includes('stream') && !t.includes('endobj')));
    
    return textMatches.join(' ').slice(0, 15000);
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '';
  }
}

// Extract text from DOCX
async function extractTextFromDOCX(base64Content: string): Promise<string> {
  try {
    let cleanBase64 = base64Content;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    
    const binaryString = atob(cleanBase64);
    
    // DOCX is a ZIP file, look for document.xml content
    // Simple approach: find readable text
    const readablePattern = /[\x20-\x7E\xC0-\xFF]{5,}/g;
    const matches = binaryString.match(readablePattern) || [];
    
    // Filter out XML tags and binary garbage
    const text = matches
      .filter(t => !t.includes('<?xml') && !t.includes('xmlns') && !t.includes('w:'))
      .join(' ');
    
    return text.slice(0, 15000);
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CompareRequest = await request.json();
    const { comparisonId, tenantId, line, files, criteria } = body;

    // Get API key from environment
    const apiKey = process.env.EMERGENT_LLM_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Extract text from files
    const extractedTexts: { name: string; content: string }[] = [];

    for (const file of files) {
      let text = '';
      
      if (file.file_type === 'pdf') {
        text = await extractTextFromPDF(file.base64_content);
      } else if (file.file_type === 'docx') {
        text = await extractTextFromDOCX(file.base64_content);
      }

      if (text.trim()) {
        extractedTexts.push({ name: file.name, content: text });
        console.log(`Extracted ${text.length} chars from ${file.name}`);
      }
    }

    if (extractedTexts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo extraer texto de los archivos. Verifica que los PDFs contengan texto (no sean imágenes escaneadas).'
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

    // Call Gemini API directly
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Eres un experto analista de seguros. Analiza cotizaciones y extrae información estructurada. Responde SOLO con JSON válido.\n\n${analysisPrompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json({
        success: false,
        error: `Error de API: ${geminiResponse.status}`
      });
    }

    const geminiResult = await geminiResponse.json();
    let responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Clean and parse JSON
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
      console.error('Failed to parse AI response:', responseText.slice(0, 500));
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

Genera una recomendación concisa (máximo 3 párrafos) para el cliente que incluya:
1. Cuál cotización ofrece mejor relación costo-beneficio
2. Puntos fuertes y débiles de cada opción
3. Recomendación final

Sé objetivo y profesional. No uses markdown, solo texto plano.`;

    const recResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: recommendationPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        })
      }
    );

    let recommendation = 'No se pudo generar la recomendación.';
    if (recResponse.ok) {
      const recResult = await recResponse.json();
      recommendation = recResult.candidates?.[0]?.content?.parts?.[0]?.text || recommendation;
    }

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
