// =====================================================
// SERVICE: Document Generator
// Genera PDFs para cotizaciones y DOCX para comparativos
// =====================================================

import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface QuotationData {
  id: string;
  line: string;
  created_at: string;
  comparison_table: {
    type: string;
    quotation?: {
      tipo_documento?: string;
      datos_extraidos?: {
        contratante?: string;
        beneficiario?: string;
        objeto?: string;
        valor_contrato?: string;
        plazo?: string;
        ubicacion?: string;
      };
      cotizacion_sugerida?: {
        tipo_fianza?: string;
        valor_asegurado?: string;
        vigencia?: string;
        tasa_estimada?: string;
        prima_estimada?: string;
        requisitos?: string[];
        observaciones?: string;
      };
    };
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

// Función para generar PDF de cotización
export async function generateQuotationPDF(
  data: QuotationData,
  tenantSettings: TenantSettings
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

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

  // Logo
  if (tenantSettings.logo_url) {
    try {
      pdf.addImage(tenantSettings.logo_url, 'PNG', margin, y, 40, 20);
      y += 25;
    } catch (e) {
      console.log('Error adding logo:', e);
    }
  }

  // Encabezado
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.rect(0, y, pageWidth, 12, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('COTIZACIÓN DE SEGURO', pageWidth / 2, y + 8, { align: 'center' });
  y += 20;

  // Info del documento
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Fecha: ${new Date(data.created_at).toLocaleDateString('es-CO')}`, margin, y);
  pdf.text(`Ramo: ${data.line}`, pageWidth - margin, y, { align: 'right' });
  y += 10;

  // Datos del cliente
  if (data.client?.name) {
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DATOS DEL CLIENTE', margin, y);
    y += 6;

    pdf.setTextColor(50, 50, 50);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    const clientLines = [
      `Nombre: ${data.client.name}`,
      data.client.document_number ? `Documento: ${data.client.document_number}` : '',
      data.client.email ? `Email: ${data.client.email}` : '',
      data.client.phone ? `Teléfono: ${data.client.phone}` : '',
    ].filter(Boolean);

    clientLines.forEach(line => {
      pdf.text(line, margin, y);
      y += 5;
    });
    y += 5;
  }

  const quotation = data.comparison_table?.quotation;
  
  // Datos extraídos
  if (quotation?.datos_extraidos) {
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INFORMACIÓN DEL CONTRATO', margin, y);
    y += 6;

    pdf.setTextColor(50, 50, 50);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const datos = quotation.datos_extraidos;
    const infoLines = [
      datos.contratante ? `Contratante: ${datos.contratante}` : '',
      datos.beneficiario ? `Beneficiario: ${datos.beneficiario}` : '',
      datos.objeto ? `Objeto: ${datos.objeto}` : '',
      datos.valor_contrato ? `Valor del Contrato: ${datos.valor_contrato}` : '',
      datos.plazo ? `Plazo: ${datos.plazo}` : '',
      datos.ubicacion ? `Ubicación: ${datos.ubicacion}` : '',
    ].filter(Boolean);

    infoLines.forEach(line => {
      // Dividir líneas largas
      const splitLines = pdf.splitTextToSize(line, pageWidth - 2 * margin);
      splitLines.forEach((splitLine: string) => {
        pdf.text(splitLine, margin, y);
        y += 5;
      });
    });
    y += 5;
  }

  // Cotización sugerida
  if (quotation?.cotizacion_sugerida) {
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('COTIZACIÓN SUGERIDA', margin, y);
    y += 6;

    pdf.setTextColor(50, 50, 50);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const cot = quotation.cotizacion_sugerida;
    const cotLines = [
      cot.tipo_fianza ? `Tipo de Fianza: ${cot.tipo_fianza}` : '',
      cot.valor_asegurado ? `Valor Asegurado: ${cot.valor_asegurado}` : '',
      cot.vigencia ? `Vigencia: ${cot.vigencia}` : '',
      cot.tasa_estimada ? `Tasa Estimada: ${cot.tasa_estimada}` : '',
      cot.prima_estimada ? `Prima Estimada: ${cot.prima_estimada}` : '',
    ].filter(Boolean);

    cotLines.forEach(line => {
      pdf.text(line, margin, y);
      y += 5;
    });

    // Requisitos
    if (cot.requisitos && cot.requisitos.length > 0) {
      y += 3;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Requisitos:', margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      cot.requisitos.forEach((req: string) => {
        pdf.text(`• ${req}`, margin + 5, y);
        y += 5;
      });
    }

    // Observaciones
    if (cot.observaciones) {
      y += 3;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Observaciones:', margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      const obsLines = pdf.splitTextToSize(cot.observaciones, pageWidth - 2 * margin);
      obsLines.forEach((line: string) => {
        pdf.text(line, margin, y);
        y += 5;
      });
    }
  }

  // Pie de página legal
  const footerY = pdf.internal.pageSize.getHeight() - 25;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  pdf.setTextColor(120, 120, 120);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  const legalText = 'NOTA: Este documento es una cotización preliminar y está sujeto a aprobación por parte de la compañía de seguros. Las condiciones, tasas y valores aquí presentados pueden variar según la evaluación del riesgo y las políticas de suscripción vigentes.';
  const legalLines = pdf.splitTextToSize(legalText, pageWidth - 2 * margin);
  legalLines.forEach((line: string, index: number) => {
    pdf.text(line, margin, footerY + (index * 4));
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
