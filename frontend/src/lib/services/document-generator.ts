// =====================================================
// SERVICE: Document Generator
// Genera PDFs para cotizaciones y DOCX para comparativos
// Soporta estructuras JSON dinámicas
// =====================================================

import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface QuotationData {
  id: string;
  line: string;
  created_at: string;
  comparison_table: {
    type: string;
    quotation?: Record<string, unknown>;
  };
  client?: {
    name?: string;
    document_number?: string;
    email?: string;
    phone?: string;
  };
}

interface ComparisonData {
  id: string;
  line: string;
  created_at: string;
  comparison_table: {
    type: string;
    insurers?: Array<{
      name: string;
      valores_asegurados?: Array<{ concepto: string; valor: string }>;
      amparos?: Array<{ amparo: string; limite: string }>;
      deducibles?: Array<{ concepto: string; valor: string }>;
      beneficios?: string[];
      prima?: {
        prima_neta?: string;
        iva?: string;
        total_anual?: string;
      };
    }>;
  };
  client?: {
    name?: string;
    document_number?: string;
  };
}

interface TenantSettings {
  logo_url?: string | null;
  primary_color?: string;
  tenant_name?: string;
}

// Helper para formatear keys
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

// Helper para formatear valores para PDF
function formatValueForPDF(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toLocaleString('es-CO');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    if (typeof value[0] === 'object') return `[${value.length} elementos]`;
    return value.join(', ');
  }
  if (typeof value === 'object') return '[objeto]';
  return String(value);
}

// Función para generar PDF de cotización (estructura dinámica)
export async function generateQuotationPDF(
  data: QuotationData,
  tenantSettings: TenantSettings
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = 15;

  // Colores
  const primaryColor = tenantSettings.primary_color || '#3b82f6';
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  };
  const rgb = hexToRgb(primaryColor);

  // Función para verificar si necesitamos nueva página
  const checkNewPage = (requiredSpace: number = 30) => {
    if (y + requiredSpace > pageHeight - 40) {
      pdf.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  // Logo
  if (tenantSettings.logo_url) {
    try {
      pdf.addImage(tenantSettings.logo_url, 'PNG', margin, y, 35, 18);
      y += 22;
    } catch (e) {
      console.log('Error adding logo:', e);
    }
  }

  // Encabezado
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.rect(0, y, pageWidth, 10, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('COTIZACIÓN DE SEGURO', pageWidth / 2, y + 7, { align: 'center' });
  y += 15;

  // Info del documento
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Fecha: ${new Date(data.created_at).toLocaleDateString('es-CO')}`, margin, y);
  pdf.text(`Ramo: ${data.line}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // Datos del cliente
  if (data.client?.name) {
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, y, contentWidth, 18, 'F');
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DATOS DEL CLIENTE', margin + 3, y + 5);
    
    pdf.setTextColor(50, 50, 50);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nombre: ${data.client.name}`, margin + 3, y + 11);
    if (data.client.document_number) {
      pdf.text(`Documento: ${data.client.document_number}`, margin + 80, y + 11);
    }
    if (data.client.email) {
      pdf.text(`Email: ${data.client.email}`, margin + 3, y + 16);
    }
    y += 23;
  }

  // Procesar la cotización dinámicamente
  const quotation = data.comparison_table?.quotation;
  if (quotation) {
    // Función recursiva para renderizar contenido
    const renderContent = (obj: Record<string, unknown>, level: number = 0) => {
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;
        
        checkNewPage();
        
        const indent = margin + (level * 5);
        
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          // Array de objetos (como polizas, amparos, etc.)
          pdf.setTextColor(rgb.r, rgb.g, rgb.b);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(formatKey(key).toUpperCase(), indent, y);
          y += 5;
          
          value.forEach((item, idx) => {
            checkNewPage(40);
            
            // Fondo para cada item
            pdf.setFillColor(250, 250, 250);
            pdf.setDrawColor(230, 230, 230);
            
            let itemStartY = y;
            let maxY = y;
            
            pdf.setTextColor(80, 80, 80);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            
            if (typeof item === 'object' && item !== null) {
              const entries = Object.entries(item as Record<string, unknown>);
              entries.forEach(([k, v], i) => {
                if (v === null || v === undefined) return;
                
                // Calcular posición en dos columnas
                const col = i % 2;
                const row = Math.floor(i / 2);
                const xPos = indent + 3 + (col * 85);
                const yPos = itemStartY + 3 + (row * 5);
                
                if (yPos > maxY) maxY = yPos;
                
                checkNewPage();
                
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(100, 100, 100);
                const keyText = `${formatKey(k)}:`;
                pdf.text(keyText, xPos, yPos);
                
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(50, 50, 50);
                const valueText = formatValueForPDF(v);
                const truncatedValue = valueText.length > 40 ? valueText.substring(0, 37) + '...' : valueText;
                pdf.text(truncatedValue, xPos + 30, yPos);
              });
              
              // Dibujar rectángulo alrededor del item
              const itemHeight = maxY - itemStartY + 6;
              pdf.roundedRect(indent, itemStartY - 2, contentWidth - (level * 5), itemHeight, 1, 1, 'S');
              
              y = maxY + 8;
            }
          });
          y += 3;
          
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          // Objeto anidado (como tomador)
          pdf.setTextColor(rgb.r, rgb.g, rgb.b);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(formatKey(key).toUpperCase(), indent, y);
          y += 5;
          
          pdf.setTextColor(50, 50, 50);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          
          Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
            if (v === null || v === undefined) return;
            checkNewPage();
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${formatKey(k)}:`, indent + 3, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(formatValueForPDF(v), indent + 35, y);
            y += 5;
          });
          y += 3;
          
        } else {
          // Valor simple
          pdf.setTextColor(50, 50, 50);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${formatKey(key)}:`, indent, y);
          pdf.setFont('helvetica', 'normal');
          
          const valueStr = formatValueForPDF(value);
          if (valueStr.length > 80) {
            // Texto largo - dividir en líneas
            const lines = pdf.splitTextToSize(valueStr, contentWidth - 40);
            pdf.text(lines[0], indent + 35, y);
            y += 4;
            for (let i = 1; i < Math.min(lines.length, 4); i++) {
              pdf.text(lines[i], indent + 3, y);
              y += 4;
            }
          } else {
            pdf.text(valueStr, indent + 35, y);
          }
          y += 5;
        }
      }
    };
    
    renderContent(quotation as Record<string, unknown>);
  }

  // Pie de página legal
  const footerY = pageHeight - 20;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  pdf.setTextColor(120, 120, 120);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  const legalText = 'NOTA: Este documento es una cotización preliminar y está sujeto a aprobación por parte de la compañía de seguros. Las condiciones, tasas y valores aquí presentados pueden variar según la evaluación del riesgo y las políticas de suscripción vigentes.';
  const legalLines = pdf.splitTextToSize(legalText, contentWidth);
  legalLines.forEach((line: string, index: number) => {
    pdf.text(line, margin, footerY + (index * 3));
  });

  // Descargar
  pdf.save(`cotizacion_${data.line}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Función para generar DOCX de comparativo
export async function generateComparisonDOCX(
  data: ComparisonData,
  tenantSettings: TenantSettings
): Promise<void> {
  const insurers = data.comparison_table?.insurers || [];
  
  const children: (Paragraph | Table)[] = [];

  // Título
  children.push(
    new Paragraph({
      text: 'CUADRO COMPARATIVO DE COTIZACIONES',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Ramo: `, bold: true }),
        new TextRun({ text: data.line }),
        new TextRun({ text: `    Fecha: `, bold: true }),
        new TextRun({ text: new Date(data.created_at).toLocaleDateString('es-CO') }),
      ],
      spacing: { after: 200 },
    })
  );

  if (data.client?.name) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Cliente: `, bold: true }),
          new TextRun({ text: data.client.name }),
        ],
        spacing: { after: 400 },
      })
    );
  }

  // Tabla comparativa
  if (insurers.length > 0) {
    // Headers
    const headerCells = [
      new TableCell({
        children: [new Paragraph({ text: 'CONCEPTO', alignment: AlignmentType.CENTER })],
        shading: { fill: '3b82f6' },
      }),
      ...insurers.map(ins => new TableCell({
        children: [new Paragraph({ 
          text: ins.name, 
          alignment: AlignmentType.CENTER,
        })],
        shading: { fill: '3b82f6' },
      }))
    ];

    const rows = [new TableRow({ children: headerCells })];

    // Valores asegurados
    const maxValores = Math.max(...insurers.map(i => i.valores_asegurados?.length || 0));
    for (let idx = 0; idx < maxValores; idx++) {
      const cells = [
        new TableCell({
          children: [new Paragraph({ 
            text: insurers[0]?.valores_asegurados?.[idx]?.concepto || '', 
            alignment: AlignmentType.LEFT 
          })],
        }),
        ...insurers.map(ins => new TableCell({
          children: [new Paragraph({ 
            text: ins.valores_asegurados?.[idx]?.valor || '-', 
            alignment: AlignmentType.RIGHT 
          })],
        }))
      ];
      rows.push(new TableRow({ children: cells }));
    }

    // Primas
    rows.push(new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: 'PRIMA TOTAL ANUAL', alignment: AlignmentType.LEFT })],
          shading: { fill: 'e5e7eb' },
        }),
        ...insurers.map(ins => new TableCell({
          children: [new Paragraph({ 
            text: ins.prima?.total_anual || '-', 
            alignment: AlignmentType.RIGHT 
          })],
          shading: { fill: 'e5e7eb' },
        }))
      ]
    }));

    children.push(
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  // Pie legal
  children.push(
    new Paragraph({
      text: '',
      spacing: { before: 400 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ 
          text: 'NOTA: Este documento es un cuadro comparativo de referencia. Las condiciones definitivas están sujetas a la aprobación de cada compañía aseguradora.',
          italics: true,
          size: 18,
          color: '666666',
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `comparativo_${data.line}_${new Date().toISOString().split('T')[0]}.docx`);
}
