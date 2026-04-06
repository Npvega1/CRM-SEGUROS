"""
Vercel Serverless Function: Extract Client Data
Extrae datos de clientes desde documentos SARLAFT usando IA (soporta PDFs escaneados)
Registra uso en ai_usage_log para control de costos
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import base64
import asyncio
import urllib.request
import urllib.parse

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import fitz  # PyMuPDF


def log_ai_usage(tenant_id: str, user_id: str, pages: int, status: str, error_msg: str = None):
    """Registra el uso de IA en Supabase"""
    try:
        supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
        supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
        if not supabase_url or not supabase_key:
            print("[AI Log] Missing Supabase credentials, skipping log")
            return

        # Estimar costo: ~$0.01 por pagina con Gemini Pro Vision
        estimated_cost = round(pages * 0.01, 4) if status == 'success' else 0

        payload = json.dumps({
            "tenant_id": tenant_id,
            "user_id": user_id if user_id else None,
            "operation_type": "extract-client",
            "model_used": "gemini-2.5-pro",
            "pages_processed": pages,
            "status": status,
            "error_message": error_msg[:200] if error_msg else None,
            "estimated_cost_usd": estimated_cost
        }).encode('utf-8')

        url = f"{supabase_url}/rest/v1/ai_usage_log"
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
                'Prefer': 'return=minimal'
            },
            method='POST'
        )
        urllib.request.urlopen(req, timeout=5)
        print(f"[AI Log] Logged: tenant={tenant_id}, pages={pages}, status={status}, cost=${estimated_cost}")
    except Exception as e:
        print(f"[AI Log] Error logging usage: {e}")


def pdf_pages_to_base64_images(binary_data: bytes, max_pages: int = 8) -> list:
    """Convierte paginas de un PDF a imagenes base64 (para PDFs escaneados)"""
    images = []
    try:
        doc = fitz.open(stream=binary_data, filetype="pdf")
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            mat = fitz.Matrix(2.5, 2.5)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            images.append(img_base64)
            print(f"[Extract Client] Page {i+1} converted to image ({len(img_bytes)} bytes)")
        doc.close()
    except Exception as e:
        print(f"[Extract Client] Error converting PDF to images: {e}")
    return images


def extract_text_from_pdf(binary_data: bytes) -> str:
    """Intenta extraer texto de un PDF"""
    try:
        doc = fitz.open(stream=binary_data, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n".join(text_parts)
    except Exception as e:
        print(f"[Extract Client] Error extracting PDF text: {e}")
        return ""


async def process_extraction(body: dict) -> dict:
    """Procesa la extraccion de datos del cliente"""

    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY no configurada"}

    client_type = body.get('client_type', 'persona_natural')
    files = body.get('files', [])
    tenant_id = body.get('tenantId', '')
    user_id = body.get('userId', '')

    print(f"[Extract Client] Processing {client_type}, files: {len(files)}, tenant: {tenant_id}")

    all_text = ""
    all_images = []
    total_pages = 0

    for file_data in files:
        try:
            base64_content = file_data.get('base64_content', '')
            if ',' in base64_content:
                base64_content = base64_content.split(',')[1]

            binary_data = base64.b64decode(base64_content)
            file_type = file_data.get('file_type', 'pdf')
            file_name = file_data.get('name', 'documento')

            if file_type == 'pdf':
                text = extract_text_from_pdf(binary_data)
                if text.strip() and len(text.strip()) > 50:
                    all_text += f"\n\n=== DOCUMENTO: {file_name} ===\n{text[:8000]}\n"
                    # Contar paginas del PDF
                    try:
                        doc = fitz.open(stream=binary_data, filetype="pdf")
                        total_pages += len(doc)
                        doc.close()
                    except:
                        total_pages += 1
                    print(f"[Extract Client] Extracted {len(text)} chars from {file_name}")
                else:
                    print(f"[Extract Client] No text in {file_name}, converting to images...")
                    images = pdf_pages_to_base64_images(binary_data)
                    all_images.extend(images)
                    total_pages += len(images)
                    print(f"[Extract Client] Got {len(images)} page images from {file_name}")
            elif file_type in ['jpg', 'jpeg', 'png', 'webp']:
                all_images.append(base64_content)
                total_pages += 1
                print(f"[Extract Client] Added image: {file_name}")
            else:
                print(f"[Extract Client] Unsupported file type: {file_type}")
                continue

        except Exception as e:
            print(f"[Extract Client] Error processing file: {e}")
            continue

    if not all_text.strip() and not all_images:
        log_ai_usage(tenant_id, user_id, 0, 'error', 'No se pudo procesar los documentos')
        return {
            "success": False,
            "error": "No se pudo procesar los documentos. Verifique que los archivos sean PDF o imagenes validas."
        }

    all_text = all_text[:25000]

    if client_type == 'persona_natural':
        extraction_prompt = """Estas analizando un FORMULARIO SARLAFT de PERSONA NATURAL usado en el sector de seguros en Colombia.

INSTRUCCIONES CRITICAS:
- Lee CADA PAGINA del documento con extremo cuidado.
- El formulario tiene secciones claramente marcadas. Busca los datos en las secciones correctas.
- Los campos de nombre estan separados en: PRIMER APELLIDO, SEGUNDO APELLIDO, PRIMER NOMBRE, OTROS NOMBRES.
- Los campos financieros pueden estar en formato colombiano con puntos como separadores de miles (ej: 10.233.345). Convierte a numero entero sin puntos (ej: 10233345).
- Los numeros de identificacion pueden tener puntos (ej: 51.649.265). Copia el numero SIN puntos (ej: 51649265).
- Si un campo esta vacio o no es legible, usa null. NUNCA inventes datos.

ESTRUCTURA DEL FORMULARIO SARLAFT PERSONA NATURAL:

SECCION 1 - INFORMACION PERSONAL: Contiene primer apellido, segundo apellido, primer nombre, otros nombres, tipo de identificacion (CC/CE/PA/TE/RC), numero de identificacion, lugar y fecha de expedicion, fecha y lugar de nacimiento, nacionalidad, sexo (M/F), estado civil, tipo de solicitud (vinculacion/renovacion/actualizacion).

SECCION 2 - UBICACION Y CONTACTO: Contiene direccion de residencia, municipio, departamento, pais, direccion laboral, municipio laboral, departamento laboral, telefono fijo, celular, correo electronico.

SECCION 3 - INFORMACION LABORAL: Contiene ocupacion/profesion/oficio, nombre de la empresa donde trabaja, cargo, actividad economica CIIU, tipo de empleo (empleado/independiente/pensionado).

SECCION 4 - INFORMACION FINANCIERA: Contiene ingresos mensuales, egresos mensuales, total activos, total pasivos, otros ingresos mensuales, concepto de otros ingresos. ATENCION: Estos valores son NUMEROS GRANDES en pesos colombianos. Lee cada digito con cuidado. Devuelve como numero entero sin puntos ni signos.

RESPONDE UNICAMENTE con este JSON (sin markdown, sin texto adicional):
{
    "informacion_personal": {
        "primer_apellido": null,
        "segundo_apellido": null,
        "primer_nombre": null,
        "otros_nombres": null,
        "tipo_identificacion": null,
        "numero_identificacion": null,
        "lugar_expedicion": null,
        "fecha_expedicion": null,
        "fecha_nacimiento": null,
        "lugar_nacimiento": null,
        "nacionalidad": null,
        "sexo": null,
        "estado_civil": null,
        "tipo_solicitud": null
    },
    "ubicacion_contacto": {
        "direccion_residencia": null,
        "municipio_residencia": null,
        "departamento_residencia": null,
        "pais_residencia": null,
        "direccion_laboral": null,
        "municipio_laboral": null,
        "departamento_laboral": null,
        "telefono_fijo": null,
        "celular": null,
        "correo_electronico": null
    },
    "informacion_laboral": {
        "ocupacion": null,
        "nombre_empresa": null,
        "cargo": null,
        "actividad_economica_ciiu": null,
        "tipo_empleo": null
    },
    "informacion_financiera": {
        "ingresos_mensuales": null,
        "egresos_mensuales": null,
        "total_activos": null,
        "total_pasivos": null,
        "otros_ingresos": null,
        "concepto_otros_ingresos": null
    },
    "campos_verificar": [],
    "confianza_extraccion": "alta",
    "notas_extraccion": ""
}"""
    else:
        extraction_prompt = """Estas analizando un FORMULARIO SARLAFT de PERSONA JURIDICA usado en el sector de seguros en Colombia.

INSTRUCCIONES CRITICAS:
- Lee CADA PAGINA del documento con extremo cuidado.
- El formulario tiene secciones claramente marcadas. Busca los datos en las secciones correctas.
- REPRESENTANTE LEGAL: Sus datos estan en una seccion separada. Los campos son: PRIMER APELLIDO, SEGUNDO APELLIDO, NOMBRES del representante legal. NO confundas con el nombre de la empresa.
- Los campos financieros estan en formato colombiano con puntos como separadores de miles y el signo $ o S al inicio (ej: $133.915.587.923 o S 133.915.587.923). Convierte estos valores a NUMEROS SIN PUNTOS NI SIGNOS (ej: 133915587923).
- Los numeros de identificacion pueden tener puntos (ej: 800.014.338). Copia el numero SIN puntos (ej: 800014338).
- Si un campo esta vacio o no es legible, usa null. NUNCA inventes datos.

ESTRUCTURA DEL FORMULARIO SARLAFT PERSONA JURIDICA:

SECCION 1 - INFORMACION GENERAL: Contiene razon social/denominacion social, NIT (numero sin puntos), digito de verificacion (DV, un solo digito), tipo de empresa (publica/privada/mixta/sin_animo_lucro), actividad economica CIIU principal, actividad economica CIIU secundaria, numero de empleados, tipo de solicitud (vinculacion/renovacion/actualizacion).

SECCION 2 - UBICACION Y CONTACTO: Contiene direccion oficina principal, municipio, departamento, pais, direccion sucursal o agencia, telefono, celular, correo electronico.

SECCION 3 - REPRESENTANTE LEGAL: Esta seccion tiene los datos personales del representante legal de la empresa. Contiene: primer apellido del representante, segundo apellido del representante, nombres del representante, tipo de identificacion (CC/CE/PA/TE/RC), numero de identificacion, lugar de expedicion, fecha de expedicion (formato YYYY-MM-DD), fecha de nacimiento (formato YYYY-MM-DD), lugar de nacimiento, sexo (M o F), estado civil, nacionalidad.

SECCION 4 - INFORMACION FINANCIERA: Contiene total activos, total pasivos, total patrimonio, ingresos mensuales, egresos mensuales, otros ingresos. ATENCION: Estos son valores MUY GRANDES en pesos colombianos (millones o miles de millones). Lee CADA DIGITO con extremo cuidado. Devuelve el valor como numero entero sin puntos ni comas (ej: si ves "$133.915.587.923" devuelve 133915587923).

RESPONDE UNICAMENTE con este JSON (sin markdown, sin texto adicional):
{
    "informacion_general": {
        "razon_social": null,
        "nit": null,
        "digito_verificacion": null,
        "tipo_empresa": null,
        "actividad_economica_ciiu_principal": null,
        "actividad_economica_ciiu_secundaria": null,
        "numero_empleados": null,
        "tipo_solicitud": null
    },
    "ubicacion_contacto": {
        "direccion_principal": null,
        "municipio": null,
        "departamento": null,
        "pais": null,
        "direccion_sucursal": null,
        "telefono": null,
        "celular": null,
        "correo_electronico": null
    },
    "representante_legal": {
        "primer_apellido": null,
        "segundo_apellido": null,
        "nombres": null,
        "tipo_identificacion": null,
        "numero_identificacion": null,
        "lugar_expedicion": null,
        "fecha_expedicion": null,
        "fecha_nacimiento": null,
        "lugar_nacimiento": null,
        "sexo": null,
        "estado_civil": null,
        "nacionalidad": null
    },
    "informacion_financiera": {
        "total_activos": null,
        "total_pasivos": null,
        "total_patrimonio": null,
        "ingresos_mensuales": null,
        "egresos_mensuales": null,
        "otros_ingresos": null
    },
    "campos_verificar": [],
    "confianza_extraccion": "alta",
    "notas_extraccion": ""
}"""

    if all_text.strip():
        extraction_prompt += f"\n\nTEXTO EXTRAIDO DE LOS DOCUMENTOS:\n{all_text}"

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"extract-client-{tenant_id}",
            system_message="""Eres un experto en seguros colombiano especializado en leer y extraer datos de formularios SARLAFT.
Tu UNICA tarea es leer el formulario SARLAFT adjunto y extraer los datos que se te piden.
Lee el documento con EXTREMO CUIDADO, especialmente:
- El nombre del REPRESENTANTE LEGAL (primer apellido, segundo apellido, nombres) que esta en una seccion separada del nombre de la empresa.
- Los valores FINANCIEROS: lee cada digito con cuidado. Son valores en pesos colombianos que pueden ser de miles de millones. Devuelve SIEMPRE como numero entero sin puntos ni comas.
- Los numeros de identificacion: copia cada digito correctamente, sin puntos.
Siempre responde SOLO con JSON valido. Sin markdown. Sin explicaciones. Solo el JSON."""
        ).with_model("gemini", "gemini-2.5-pro")

        if all_images:
            image_contents = [ImageContent(image_base64=img) for img in all_images[:8]]
            user_message = UserMessage(
                text=extraction_prompt,
                file_contents=image_contents
            )
            print(f"[Extract Client] Sending {len(image_contents)} images to Gemini Pro...")
        else:
            user_message = UserMessage(text=extraction_prompt)
            print("[Extract Client] Sending text-only to Gemini Pro...")

        response_text = await chat.send_message(user_message)
        print(f"[Extract Client] Response length: {len(response_text)}")

        clean_response = response_text.strip()
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
                if part.startswith('{'):
                    clean_response = part
                    break

        if not clean_response.startswith('{'):
            for i, char in enumerate(clean_response):
                if char == '{':
                    clean_response = clean_response[i:]
                    break

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

        extraction_data = json.loads(clean_response)

        campos_verificar = extraction_data.get('campos_verificar', [])
        confianza = extraction_data.get('confianza_extraccion', 'media')
        needs_verification = len(campos_verificar) > 0 or confianza in ['baja', 'media']

        # Registrar uso exitoso
        log_ai_usage(tenant_id, user_id, total_pages, 'success')

        return {
            "success": True,
            "data": extraction_data,
            "needs_verification": needs_verification,
            "verification_fields": campos_verificar if campos_verificar else None
        }

    except json.JSONDecodeError as e:
        log_ai_usage(tenant_id, user_id, total_pages, 'error', f"JSON parse: {str(e)[:100]}")
        print(f"[Extract Client] JSON parse error: {e}")
        return {"success": False, "error": f"Error al parsear respuesta de IA: {str(e)[:100]}"}
    except Exception as e:
        log_ai_usage(tenant_id, user_id, total_pages, 'error', str(e)[:200])
        print(f"[Extract Client] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)[:200]}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode('utf-8'))

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(process_extraction(body))
            loop.close()

            self.send_response(200 if result.get('success') else 500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))

        except Exception as e:
            print(f"[Extract Client] Handler error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": str(e)
            }).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
