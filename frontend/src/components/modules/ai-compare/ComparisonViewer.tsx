'use client';

// =====================================================
// COMPONENTE: ComparisonViewer
// Visualizador de cuadro comparativo - TABLA LADO A LADO
// Con exportación a Word
// =====================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ComparisonWithRelations } from '@/lib/validations/comparisons';
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { 
  Download, 
  Edit2, 
  Check, 
  X,
  Sparkles,
  Building2,
  User,
  Calendar,
  Loader2,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tipos para la nueva estructura
interface InsurerData {
  name: string;
  informacion_riesgo?: {
    cliente?: string;
    direccion?: string;
    ciudad?: string;
    descripcion_riesgo?: string;
  };
  valores_asegurados?: Array<{ concepto: string; valor: string }>;
  amparos?: Array<{ amparo: string; limite?: string }>;
  deducibles?: Array<{ concepto: string; valor: string }>;
  beneficios?: string[];
  prima?: {
    total_anual?: string;
    forma_pago?: string;
  };
}

interface ComparisonTable {
  line?: string;
  insurers: InsurerData[];
}

interface ComparisonViewerProps {
  comparison: ComparisonWithRelations;
  onUpdateCell: (insurerKey: string, criteriaKey: string, newValue: string) => Promise<void>;
  onUpdateRecommendation: (recommendation: string) => Promise<void>;
  onCreatePolicy?: (insurerName: string) => void;
  branding?: {
    logoUrl?: string;
    agencyName?: string;
    primaryColor?: string;
  };
}

export function ComparisonViewer({
  comparison,
  onUpdateRecommendation,
  branding
}: ComparisonViewerProps) {
  const [isEditingRecommendation, setIsEditingRecommendation] = useState(false);
  const [recommendationValue, setRecommendationValue] = useState(comparison.ai_recommendation || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const table = comparison.comparison_table as ComparisonTable | null;
  const prospectName = (comparison as unknown as { prospect_name?: string }).prospect_name;
  const clientName = comparison.client?.full_name || prospectName || 'No especificado';

  if (!table || !table.insurers || table.insurers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No hay datos de comparación disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  const insurers = table.insurers;
  const numInsurers = insurers.length;

  const handleSaveRecommendation = async () => {
    setIsSaving(true);
    try {
      await onUpdateRecommendation(recommendationValue);
      setIsEditingRecommendation(false);
    } catch (error) {
      console.error('Error saving recommendation:', error);
    }
    setIsSaving(false);
  };

  // Función para exportar a Word
  const exportToWord = async () => {
    setIsExporting(true);
    
    try {
      const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel } = await import('docx');
      const { saveAs } = await import('file-saver');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = [];
      
      // Título
      children.push(
        new Paragraph({
          children: [new TextRun({ text: branding?.agencyName || 'Agencia de Seguros', bold: true, size: 32 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'CUADRO COMPARATIVO DE COTIZACIONES', bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Cliente: ', bold: true }),
            new TextRun({ text: clientName }),
            new TextRun({ text: '   |   Ramo: ', bold: true }),
            new TextRun({ text: POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line }),
            new TextRun({ text: '   |   Fecha: ', bold: true }),
            new TextRun({ text: comparison.created_at ? format(new Date(comparison.created_at), 'dd/MM/yyyy') : 'N/A' }),
          ],
          spacing: { after: 400 },
        })
      );

      // Tabla comparativa de PRIMAS (lo más importante)
      children.push(
        new Paragraph({ text: 'RESUMEN DE PRIMAS', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
      );

      const primaRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Aseguradora', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Prima Anual', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Forma de Pago', bold: true })] })] }),
          ],
        }),
        ...insurers.map(ins => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(ins.name)] }),
            new TableCell({ children: [new Paragraph(ins.prima?.total_anual || 'No especificado')] }),
            new TableCell({ children: [new Paragraph(ins.prima?.forma_pago || 'No especificado')] }),
          ],
        })),
      ];

      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: primaRows }));

      // Tabla de VALORES ASEGURADOS
      children.push(
        new Paragraph({ text: 'VALORES ASEGURADOS', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
      );

      // Obtener todos los conceptos únicos
      const allConceptos = new Set<string>();
      insurers.forEach(ins => ins.valores_asegurados?.forEach(v => allConceptos.add(v.concepto)));

      const valoresRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Concepto', bold: true })] })] }),
            ...insurers.map(ins => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ins.name, bold: true })] })] })),
          ],
        }),
        ...Array.from(allConceptos).map(concepto => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(concepto)] }),
            ...insurers.map(ins => {
              const valor = ins.valores_asegurados?.find(v => v.concepto === concepto)?.valor || '-';
              return new TableCell({ children: [new Paragraph(valor)] });
            }),
          ],
        })),
      ];

      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: valoresRows }));

      // Tabla de AMPAROS
      children.push(
        new Paragraph({ text: 'AMPAROS / COBERTURAS', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
      );

      const allAmparos = new Set<string>();
      insurers.forEach(ins => ins.amparos?.forEach(a => allAmparos.add(a.amparo)));

      const amparosRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Amparo', bold: true })] })] }),
            ...insurers.map(ins => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ins.name, bold: true })] })] })),
          ],
        }),
        ...Array.from(allAmparos).map(amparo => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(amparo)] }),
            ...insurers.map(ins => {
              const amp = ins.amparos?.find(a => a.amparo === amparo);
              return new TableCell({ children: [new Paragraph(amp?.limite || '-')] });
            }),
          ],
        })),
      ];

      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: amparosRows }));

      // Tabla de DEDUCIBLES
      children.push(
        new Paragraph({ text: 'DEDUCIBLES', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
      );

      const allDeducibles = new Set<string>();
      insurers.forEach(ins => ins.deducibles?.forEach(d => allDeducibles.add(d.concepto)));

      const deduciblesRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Deducible', bold: true })] })] }),
            ...insurers.map(ins => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ins.name, bold: true })] })] })),
          ],
        }),
        ...Array.from(allDeducibles).map(ded => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(ded)] }),
            ...insurers.map(ins => {
              const deducible = ins.deducibles?.find(d => d.concepto === ded);
              return new TableCell({ children: [new Paragraph(deducible?.valor || '-')] });
            }),
          ],
        })),
      ];

      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: deduciblesRows }));

      // Recomendación
      if (comparison.ai_recommendation) {
        children.push(
          new Paragraph({ text: 'RECOMENDACIÓN', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
          new Paragraph({ text: comparison.ai_recommendation, spacing: { after: 200 } })
        );
      }

      // Crear documento
      const doc = new Document({
        sections: [{ properties: {}, children }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Comparativo_${clientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.docx`);
      
    } catch (error) {
      console.error('Error exporting to Word:', error);
      alert('Error al exportar. Por favor intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  };

  // Obtener todos los conceptos únicos para las tablas comparativas
  const allValores = new Set<string>();
  const allAmparos = new Set<string>();
  const allDeducibles = new Set<string>();
  
  insurers.forEach(ins => {
    ins.valores_asegurados?.forEach(v => allValores.add(v.concepto));
    ins.amparos?.forEach(a => allAmparos.add(a.amparo));
    ins.deducibles?.forEach(d => allDeducibles.add(d.concepto));
  });

  return (
    <div className="space-y-6" data-testid="comparison-viewer">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">Cuadro Comparativo de Cotizaciones</CardTitle>
                <p className="text-sm text-muted-foreground">{branding?.agencyName || 'Agencia de Seguros'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}</Badge>
              <Button variant="default" size="sm" onClick={exportToWord} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Descargar Word
              </Button>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium">{clientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">
                  {comparison.created_at ? format(new Date(comparison.created_at), 'dd MMM yyyy', { locale: es }) : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Agente</p>
                <p className="font-medium">{comparison.agent?.full_name || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Cotizaciones</p>
                <p className="font-medium">{numInsurers} aseguradoras</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABLA COMPARATIVA DE PRIMAS */}
      <Card>
        <CardHeader className="py-3 bg-primary/5">
          <CardTitle className="text-base">💰 Resumen de Primas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-3 font-semibold border-b">Aseguradora</th>
                  <th className="text-right p-3 font-semibold border-b">Prima Anual</th>
                  <th className="text-left p-3 font-semibold border-b">Forma de Pago</th>
                </tr>
              </thead>
              <tbody>
                {insurers.map((ins, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-3 font-medium border-b">{ins.name}</td>
                    <td className="p-3 text-right font-bold text-primary border-b">{ins.prima?.total_anual || 'No especificado'}</td>
                    <td className="p-3 border-b">{ins.prima?.forma_pago || 'No especificado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* TABLA COMPARATIVA DE VALORES ASEGURADOS */}
      {allValores.size > 0 && (
        <Card>
          <CardHeader className="py-3 bg-green-50">
            <CardTitle className="text-base">📊 Valores Asegurados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-3 font-semibold border-b min-w-[200px]">Concepto</th>
                    {insurers.map((ins, i) => (
                      <th key={i} className="text-right p-3 font-semibold border-b min-w-[150px]">{ins.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(allValores).map((concepto, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3 border-b">{concepto}</td>
                      {insurers.map((ins, j) => {
                        const valor = ins.valores_asegurados?.find(v => v.concepto === concepto)?.valor;
                        return (
                          <td key={j} className="p-3 text-right border-b font-medium">
                            {valor || <span className="text-slate-400">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TABLA COMPARATIVA DE AMPAROS */}
      {allAmparos.size > 0 && (
        <Card>
          <CardHeader className="py-3 bg-blue-50">
            <CardTitle className="text-base">🛡️ Amparos / Coberturas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-3 font-semibold border-b min-w-[200px]">Amparo</th>
                    {insurers.map((ins, i) => (
                      <th key={i} className="text-left p-3 font-semibold border-b min-w-[150px]">{ins.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(allAmparos).map((amparo, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3 border-b font-medium">{amparo}</td>
                      {insurers.map((ins, j) => {
                        const amp = ins.amparos?.find(a => a.amparo === amparo);
                        return (
                          <td key={j} className="p-3 border-b">
                            {amp ? (
                              <span className="text-green-600">{amp.limite || '✓ Incluido'}</span>
                            ) : (
                              <span className="text-slate-400">No incluido</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TABLA COMPARATIVA DE DEDUCIBLES */}
      {allDeducibles.size > 0 && (
        <Card>
          <CardHeader className="py-3 bg-amber-50">
            <CardTitle className="text-base">⚠️ Deducibles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-3 font-semibold border-b min-w-[200px]">Deducible</th>
                    {insurers.map((ins, i) => (
                      <th key={i} className="text-left p-3 font-semibold border-b min-w-[150px]">{ins.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(allDeducibles).map((ded, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3 border-b font-medium">{ded}</td>
                      {insurers.map((ins, j) => {
                        const deducible = ins.deducibles?.find(d => d.concepto === ded);
                        return (
                          <td key={j} className="p-3 border-b">
                            {deducible?.valor || <span className="text-slate-400">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BENEFICIOS ADICIONALES */}
      <Card>
        <CardHeader className="py-3 bg-purple-50">
          <CardTitle className="text-base">🎁 Beneficios Adicionales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {insurers.map((ins, i) => (
                    <th key={i} className="text-left p-3 font-semibold border-b">{ins.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {insurers.map((ins, i) => (
                    <td key={i} className="p-3 border-b align-top">
                      {ins.beneficios && ins.beneficios.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {ins.beneficios.map((ben, j) => (
                            <li key={j} className="text-sm">{ben}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">No especificados</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Recomendación de la IA
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsEditingRecommendation(!isEditingRecommendation)}>
              <Edit2 className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingRecommendation ? (
            <div className="space-y-3">
              <Textarea
                value={recommendationValue}
                onChange={(e) => setRecommendationValue(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRecommendationValue(comparison.ai_recommendation || '');
                    setIsEditingRecommendation(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveRecommendation} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
              {comparison.ai_recommendation || 'No hay recomendación disponible.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
