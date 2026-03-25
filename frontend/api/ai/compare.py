"""
Vercel Serverless Function: AI Compare
Procesa comparativos y cotizaciones de seguros usando Gemini via emergentintegrations
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import base64
import tempfile
import asyncio

# Importar emergentintegrations
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Para extraer texto de PDFs
import fitz  # PyMuPDF


def extract_text_from_pdf(binary_data: bytes) -> str:
    """Extrae texto de un PDF usando PyMuPDF"""
    try:
        doc = fitz.open(stream=binary_data, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""


async def process_comparison(body: dict) -> dict:
    """Procesa la comparación o cotización"""
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY no configurada"}
    
    comparison_id = body.get('comparisonId', '')
    line = body.get('line', '')
    files = body.get('files', [])
    operation_type = body.get('operation_type', 'comparison')
    example_structure = body.get('example_structure', '')  # Ejemplo de estructura del prompt
    custom_prompt = body.get('custom_prompt', '')  # Prompt personalizado del ramo
    
    print(f"[AI Compare] Processing {operation_type} for {comparison_id}")
    print(f"[AI Compare] Line: {line}, Files: {len(files)}")
    print(f"[AI Compare] Has example structure: {bool(example_structure)}")
    print(f"[AI Compare] Has custom prompt: {bool(custom_prompt)}")
    
    # Extraer texto de cada archivo
    extracted_texts = []
    
    for file_data in files:
        try:
            file_name = file_data.get('name', 'archivo')
            
            # Verificar si ya tenemos texto extraído del frontend
            extracted_text = file_data.get('extracted_text', '')
            
            if extracted_text and len(extracted_text) > 100:
                # Usar texto extraído del frontend
                extracted_texts.append({
                    "name": file_name,
                    "content": extracted_text[:50000]  # Ya está limitado en frontend
                })
                print(f"[AI Compare] Using pre-extracted text: {len(extracted_text)} chars from {file_name}")
            else:
                # Extraer texto del base64
                base64_content = file_data.get('base64_content', '')
                
                if not base64_content:
                    print(f"[AI Compare] No content for {file_name}, skipping")
                    continue
                
                # Limpiar base64
                if ',' in base64_content:
                    base64_content = base64_content.split(',')[1]
                
                binary_data = base64.b64decode(base64_content)
                file_type = file_data.get('file_type', 'pdf')
                
                # Extraer texto
                if file_type == 'pdf':
                    text = extract_text_from_pdf(binary_data)
                else:
                    text = ""
                
                if text.strip():
                    extracted_texts.append({
                        "name": file_name,
                        "content": text[:50000]
                    })
                    print(f"[AI Compare] Extracted {len(text)} chars from {file_name}")
                else:
                    print(f"[AI Compare] No text extracted from {file_name}")
                
        except Exception as e:
            print(f"[AI Compare] Error processing file: {e}")
            continue
    
    if not extracted_texts:
        return {
            "success": False, 
            "error": "No se pudo extraer texto de los archivos. Verifica que los PDFs contengan texto y no sean imágenes escaneadas."
        }
    
    # Determinar si es cotización o comparativo
    is_quotation = operation_type == 'quotation'
    
    # Construir sección de ejemplo de estructura si existe
    example_section = ""
    if example_structure and example_structure.strip():
        example_section = f"""

IMPORTANTE - USA ESTE FORMATO DE ESTRUCTURA COMO REFERENCIA:
{'='*60}
{example_structure[:6000]}
{'='*60}

Tu respuesta DEBE seguir el mismo formato y estructura del ejemplo anterior.
"""
    
    # Construir sección de instrucciones personalizadas si existe
    custom_instructions = ""
    if custom_prompt and custom_prompt.strip():
        custom_instructions = f"""

INSTRUCCIONES ADICIONALES DEL ADMINISTRADOR:
{custom_prompt}
"""
    
    # Construir prompt
    if is_quotation:
        doc = extracted_texts[0]
        analysis_prompt = f"""Eres un experto en seguros y fianzas colombiano. Analiza este documento del ramo "{line}" y genera una cotización estructurada.
{example_section}
{'='*60}
DOCUMENTO A ANALIZAR: {doc['name']}
{'='*60}
{doc['content']}

INSTRUCCIONES:
1. Extrae toda la información relevante del documento
2. Identifica: partes involucradas, montos, plazos, objeto del contrato
3. Genera una estructura de cotización basada en la información extraída
{custom_instructions}
RESPONDE SOLO CON JSON VÁLIDO (sin markdown). Si hay un ejemplo de estructura arriba, sigue ese formato exacto.
Si no hay ejemplo, usa este formato por defecto:
{{
  "tipo_documento": "Contrato/Solicitud/Otro",
  "datos_extraidos": {{
    "contratante": "Nombre del contratante",
    "beneficiario": "Nombre del beneficiario (si aplica)",
    "objeto": "Descripción del objeto o servicio",
    "valor_contrato": "$X,XXX,XXX",
    "plazo": "X meses/años",
    "ubicacion": "Ciudad/Departamento"
  }},
  "cotizacion_sugerida": {{
    "tipo_fianza": "Cumplimiento/Anticipo/Calidad/etc.",
    "valor_asegurado": "$X,XXX,XXX",
    "vigencia": "X meses",
    "tasa_estimada": "X.X%",
    "prima_estimada": "$X,XXX,XXX",
    "requisitos": ["Requisito 1", "Requisito 2"],
    "observaciones": "Notas adicionales"
  }}
}}"""
    else:
        files_content = ""
        for i, doc in enumerate(extracted_texts, 1):
            files_content += f"\n\n{'='*60}\nCOTIZACIÓN {i}: {doc['name']}\n{'='*60}\n{doc['content']}\n"
        
        # Detectar si es PYME/Hogar/Copropiedades para usar estructura especializada
        is_poliza_comparison = any(x in line.lower() for x in ['pyme', 'hogar', 'copropiedad', 'multiriesgo', 'empresarial'])
        
        if is_poliza_comparison:
            # Estructura simplificada para PYME/Hogar/Copropiedades - OPTIMIZADO para velocidad
            analysis_prompt = f"""Analiza estas cotizaciones de seguros y devuelve un JSON comparativo.

COTIZACIONES:
{files_content}

RESPONDE SOLO JSON (sin markdown, sin explicaciones):
{{
  "aseguradoras": [
    {{
      "nombre": "ASEGURADORA",
      "producto": "Producto",
      "recomendada": true/false,
      "valoresAsegurados": {{"edificio": 0, "contenidos": 0, "total": 0}},
      "amparos": [{{"nombre": "Amparo", "valorAsegurado": 0, "deducible": "X%"}}],
      "prima": {{"netaAnteIva": 0, "iva": 0, "total": 0}}
    }}
  ],
  "resumen_recomendacion": "Breve recomendación"
}}

Extrae los valores numéricos sin formato (solo números). Marca recomendada=true la mejor opción."""
        else:
            # Estructura genérica para otros ramos
            analysis_prompt = f"""Eres un experto analista de seguros colombiano. Analiza estas {len(extracted_texts)} cotizaciones del ramo "{line}" y crea un cuadro comparativo.
{example_section}
{files_content}
{custom_instructions}
RESPONDE SOLO CON JSON VÁLIDO (sin markdown). Si hay un ejemplo de estructura arriba, sigue ese formato exacto.
Si no hay ejemplo, usa este formato por defecto:
{{
  "insurers": [
    {{
      "name": "NOMBRE ASEGURADORA",
      "valores_asegurados": [
        {{"concepto": "Edificio", "valor": "$600,000,000"}},
        {{"concepto": "Contenidos", "valor": "$50,000,000"}},
        {{"concepto": "TOTAL ASEGURADO", "valor": "$650,000,000"}}
      ],
      "amparos": [
        {{"amparo": "Incendio y Rayo", "limite": "100%"}},
        {{"amparo": "Terremoto", "limite": "100%"}},
        {{"amparo": "Hurto Calificado", "limite": "$30,000,000"}}
      ],
      "deducibles": [
        {{"concepto": "Incendio/Básico", "valor": "0.5% del valor de la pérdida"}},
        {{"concepto": "Terremoto", "valor": "3% valor asegurado"}}
      ],
      "beneficios": ["Asistencia domiciliaria 24/7", "Hospedaje temporal"],
      "prima": {{
        "prima_neta": "$1,000,000",
        "iva": "$190,000",
        "total_anual": "$1,190,000"
      }}
    }}
  ]
}}"""

    response_text = ""  # Initialize for error handling
    try:
        # Inicializar chat con Gemini via emergentintegrations
        chat = LlmChat(
            api_key=api_key,
            session_id=f"comparison-{comparison_id}",
            system_message="Eres un experto analista de seguros colombiano. Responde SOLO con JSON válido, sin explicaciones adicionales."
        ).with_model("gemini", "gemini-2.5-flash")
        
        print("[AI Compare] Calling Gemini API...")
        response_text = await chat.send_message(UserMessage(text=analysis_prompt))
        print(f"[AI Compare] Response length: {len(response_text)}")
        print(f"[AI Compare] Response preview: {response_text[:500]}")
        
        # Parsear respuesta JSON con mejor manejo
        clean_response = response_text.strip()
        
        # Remover markdown code blocks de varias formas
        if '```json' in clean_response:
            start = clean_response.find('```json') + 7
            end = clean_response.rfind('```')
            if end > start:
                clean_response = clean_response[start:end].strip()
        elif '```' in clean_response:
            parts = clean_response.split('```')
            for part in parts:
                part = part.strip()
                if part.startswith('json'):
                    part = part[4:].strip()
                if part.startswith('{') or part.startswith('['):
                    clean_response = part
                    break
        
        # Asegurar que empieza con { o [
        if not (clean_response.startswith('{') or clean_response.startswith('[')):
            # Buscar el primer { o [
            json_start = -1
            for i, char in enumerate(clean_response):
                if char in '{[':
                    json_start = i
                    break
            if json_start >= 0:
                clean_response = clean_response[json_start:]
        
        # Encontrar el final del JSON
        if clean_response.startswith('{'):
            depth = 0
            json_end = -1
            for i, char in enumerate(clean_response):
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        json_end = i + 1
                        break
            if json_end > 0:
                clean_response = clean_response[:json_end]
        
        print(f"[AI Compare] Clean JSON preview: {clean_response[:300]}")
        
        try:
            comparison_data = json.loads(clean_response)
        except json.JSONDecodeError as je:
            print(f"[AI Compare] JSON parse error at position {je.pos}: {je.msg}")
            print(f"[AI Compare] Problematic area: {clean_response[max(0, je.pos-50):je.pos+50]}")
            raise
        
        # Construir resultado
        if is_quotation:
            comparison_table = {
                "line": line,
                "type": "quotation",
                "quotation": comparison_data
            }
        else:
            # Verificar si tiene estructura de aseguradoras (PYME/Hogar/Copropiedades)
            if "aseguradoras" in comparison_data:
                comparison_table = {
                    "line": line,
                    "type": "comparison",
                    "aseguradoras": comparison_data.get("aseguradoras", []),
                    "resumen_recomendacion": comparison_data.get("resumen_recomendacion", "")
                }
            else:
                # Estructura genérica con insurers
                comparison_table = {
                    "line": line,
                    "type": "comparison",
                    "insurers": comparison_data.get("insurers", [])
                }
        
        return {
            "success": True,
            "comparison_table": comparison_table
        }
        
    except json.JSONDecodeError as e:
        print(f"[AI Compare] JSON parse error: {e}")
        print(f"[AI Compare] Response was: {response_text[:1000] if 'response_text' in dir() else 'N/A'}")
        return {"success": False, "error": f"La IA no devolvió un JSON válido. Error: {str(e)[:100]}"}
    except Exception as e:
        print(f"[AI Compare] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": f"Error procesando: {str(e)[:200]}"}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Leer body
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode('utf-8'))
            
            # Procesar comparación
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(process_comparison(body))
            loop.close()
            
            # Responder
            self.send_response(200 if result.get('success') else 500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            
        except Exception as e:
            print(f"[AI Compare] Handler error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": str(e)
            }).encode('utf-8'))
    
    def do_OPTIONS(self):
        # CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
