'use client';

// =====================================================
// COMPONENTE: ComparisonViewer
// Visualizador de cuadro comparativo
// =====================================================

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ComparisonWithRelations, ComparisonTable } from '@/lib/validations/comparisons';
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Share2, 
  Edit2, 
  Check, 
  X,
  Sparkles,
  Building2,
  User,
  Calendar,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface ComparisonViewerProps {
  comparison: ComparisonWithRelations;
  onUpdateCell: (insurerKey: string, criteriaKey: string, newValue: string) => Promise<void>;
  onUpdateRecommendation: (recommendation: string) => Promise<void>;
  onExportPDF?: () => Promise<void>;
  onExportXLSX?: () => void;
  onShare?: () => void;
  onCreatePolicy?: (insurerName: string) => void;
  branding?: {
    logoUrl?: string;
    agencyName?: string;
    primaryColor?: string;
  };
}

export function ComparisonViewer({
  comparison,
  onUpdateCell,
  onUpdateRecommendation,
  onExportPDF,
  onExportXLSX,
  onShare,
  onCreatePolicy,
  branding
}: ComparisonViewerProps) {
  const [editingCell, setEditingCell] = useState<{ insurer: string; criteria: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isEditingRecommendation, setIsEditingRecommendation] = useState(false);
  const [recommendationValue, setRecommendationValue] = useState(comparison.ai_recommendation || '');
  const [isSaving, setIsSaving] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const table = comparison.comparison_table as ComparisonTable | null;

  if (!table) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No hay datos de comparación disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  const handleStartEdit = (insurer: string, criteria: string, currentValue: string) => {
    setEditingCell({ insurer, criteria });
    setEditValue(currentValue);
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    
    setIsSaving(true);
    try {
      await onUpdateCell(editingCell.insurer, editingCell.criteria, editValue);
      setEditingCell(null);
    } catch (error) {
      console.error('Error saving cell:', error);
    }
    setIsSaving(false);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

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

  const handleExportXLSX = () => {
    if (onExportXLSX) {
      onExportXLSX();
      return;
    }

    // Default XLSX export
    const wsData: string[][] = [];
    
    // Header row
    const headerRow = ['Criterio', ...table.insurers.map(i => i.name)];
    wsData.push(headerRow);
    
    // Data rows
    for (const criteria of table.criteria) {
      const row = [criteria];
      for (const insurer of table.insurers) {
        const field = insurer.fields[criteria];
        row.push(field?.value || '-');
      }
      wsData.push(row);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativo');
    
    // Add recommendation as second sheet
    if (comparison.ai_recommendation) {
      const recWs = XLSX.utils.aoa_to_sheet([
        ['Recomendación de la IA'],
        [comparison.ai_recommendation]
      ]);
      XLSX.utils.book_append_sheet(wb, recWs, 'Recomendación');
    }
    
    XLSX.writeFile(wb, `Comparativo_${comparison.client?.full_name || 'Cliente'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Find best values per criteria (lowest price, highest coverage)
  const getBestInsurerForCriteria = (criteria: string): string | null => {
    const isPriceField = criteria.toLowerCase().includes('prima') || criteria.toLowerCase().includes('precio');
    
    let bestInsurer: string | null = null;
    let bestValue: number | null = null;
    
    for (const insurer of table.insurers) {
      const field = insurer.fields[criteria];
      if (!field?.value) continue;
      
      // Try to extract numeric value
      const numericValue = parseFloat(field.value.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (isNaN(numericValue)) continue;
      
      if (bestValue === null) {
        bestValue = numericValue;
        bestInsurer = insurer.name;
      } else if (isPriceField && numericValue < bestValue) {
        bestValue = numericValue;
        bestInsurer = insurer.name;
      } else if (!isPriceField && numericValue > bestValue) {
        bestValue = numericValue;
        bestInsurer = insurer.name;
      }
    }
    
    return bestInsurer;
  };

  return (
    <div className="space-y-6" data-testid="comparison-viewer">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {branding?.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt="Logo" 
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">
                  Cuadro Comparativo de Cotizaciones
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {branding?.agencyName || 'Agencia de Seguros'}
                </p>
              </div>
            </div>
            <Badge variant="secondary">
              {POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium">{comparison.client?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">
                  {format(new Date(comparison.created_at), 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Agente</p>
                <p className="font-medium">{comparison.agent?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Cotizaciones</p>
                <p className="font-medium">{table.insurers.length} aseguradoras</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tabla Comparativa</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportXLSX}
                data-testid="export-xlsx-btn"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              {onExportPDF && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportPDF}
                  data-testid="export-pdf-btn"
                >
                  <Download className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              )}
              {onShare && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onShare}
                  data-testid="share-btn"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Compartir
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0" ref={tableRef}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] font-semibold bg-slate-50">
                    Criterio
                  </TableHead>
                  {table.insurers.map((insurer) => (
                    <TableHead 
                      key={insurer.name} 
                      className="min-w-[180px] font-semibold bg-slate-50"
                    >
                      <div className="flex items-center justify-between">
                        <span>{insurer.name}</span>
                        {onCreatePolicy && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => onCreatePolicy(insurer.name)}
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            Póliza
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.criteria.map((criteria) => {
                  const bestInsurer = getBestInsurerForCriteria(criteria);
                  
                  return (
                    <TableRow key={criteria}>
                      <TableCell className="font-medium bg-slate-50/50">
                        {criteria}
                      </TableCell>
                      {table.insurers.map((insurer) => {
                        const field = insurer.fields[criteria];
                        const value = field?.value || '-';
                        const notes = field?.notes;
                        const isBest = bestInsurer === insurer.name;
                        const isEditing = editingCell?.insurer === insurer.name && 
                                         editingCell?.criteria === criteria;

                        return (
                          <TableCell 
                            key={`${insurer.name}-${criteria}`}
                            className={`relative group ${isBest ? 'bg-green-50' : ''}`}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleSaveEdit}
                                  disabled={isSaving}
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4 text-green-600" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className={isBest ? 'font-semibold text-green-700' : ''}>
                                    {value}
                                  </span>
                                  {notes && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {notes}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleStartEdit(insurer.name, criteria, value)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingRecommendation(!isEditingRecommendation)}
            >
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
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveRecommendation}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
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
