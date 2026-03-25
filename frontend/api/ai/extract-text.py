"""
Vercel Serverless Function: Extract Text from PDF/DOCX
Extrae texto de archivos para usar como ejemplos de estructura
"""

from http.server import BaseHTTPRequestHandler
import json
import base64

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


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Leer body
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode('utf-8'))
            
            file_name = body.get('file_name', 'archivo')
            file_type = body.get('file_type', 'pdf')
            base64_content = body.get('base64_content', '')
            
            print(f"[Extract Text] Processing {file_name} ({file_type})")
            
            # Limpiar base64
            if ',' in base64_content:
                base64_content = base64_content.split(',')[1]
            
            binary_data = base64.b64decode(base64_content)
            
            # Extraer texto según el tipo
            text = ""
            if file_type == 'pdf':
                text = extract_text_from_pdf(binary_data)
            elif file_type in ['docx', 'doc']:
                # Para DOCX podríamos usar python-docx pero por ahora solo PDF
                text = "[Extracción de DOCX no disponible - use PDF]"
            
            print(f"[Extract Text] Extracted {len(text)} characters")
            
            # Responder
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "text": text[:50000]  # Limitar a 50k caracteres
            }).encode('utf-8'))
            
        except Exception as e:
            print(f"[Extract Text] Error: {e}")
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
