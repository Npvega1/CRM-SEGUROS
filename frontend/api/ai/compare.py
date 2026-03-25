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
    
    print(f"[AI Compare] Processing {operation_type} for {comparison_id}")
    print(f"[AI Compare] Line: {line}, Files: {len(files)}")
    
    # Extraer texto de cada archivo
    extracted_texts = []
    
    for file_data in files:
        try:
            file_name = file_data.get('name', 'archivo')
            base64_content = file_data.get('base64_content', '')
            
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
                    "content": text[:8000]  # Limitar tamaño
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
    
    # Construir prompt
    if is_quotation:
        doc = extracted_texts[0]
        analysis_prompt = f"""Eres un experto en seguros y fianzas colombiano. Analiza este documento del ramo "{line}" y genera una cotización estructurada.

{'='*60}
DOCUMENTO: {doc['name']}
{'='*60}
{doc['content']}

INSTRUCCIONES:
1. Extrae toda la información relevante del documento
2. Identifica: partes involucradas, montos, plazos, objeto del contrato
3. Genera una estructura de cotización basada en la información extraída

RESPONDE SOLO CON JSON VÁLIDO (sin markdown):
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
        
        analysis_prompt = f"""Eres un experto analista de seguros colombiano. Analiza estas {len(extracted_texts)} cotizaciones del ramo "{line}" y crea un cuadro comparativo.

{files_content}

RESPONDE SOLO CON JSON VÁLIDO (sin markdown):
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

    try:
        # Inicializar chat con Gemini via emergentintegrations
        chat = LlmChat(
            api_key=api_key,
            session_id=f"comparison-{comparison_id}",
            system_message="Eres un experto analista de seguros colombiano. Responde SOLO con JSON válido."
        ).with_model("gemini", "gemini-2.5-flash")
        
        print("[AI Compare] Calling Gemini API...")
        response_text = await chat.send_message(UserMessage(text=analysis_prompt))
        print(f"[AI Compare] Response length: {len(response_text)}")
        
        # Parsear respuesta JSON
        clean_response = response_text.strip()
        if clean_response.startswith('```'):
            clean_response = clean_response.split('```')[1]
            if clean_response.startswith('json'):
                clean_response = clean_response[4:]
        if clean_response.endswith('```'):
            clean_response = clean_response[:-3]
        
        comparison_data = json.loads(clean_response.strip())
        
        # Construir resultado
        if is_quotation:
            comparison_table = {
                "line": line,
                "type": "quotation",
                "quotation": comparison_data
            }
        else:
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
        return {"success": False, "error": "La IA no devolvió un JSON válido. Intenta de nuevo."}
    except Exception as e:
        print(f"[AI Compare] Error: {e}")
        return {"success": False, "error": str(e)}


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
