'use client';

// =====================================================
// COMPONENTE: ComparisonsList
// Lista de comparativos anteriores
// =====================================================

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ComparisonWithRelations } from '@/lib/validations/comparisons';
import { COMPARISON_STATUS_LABELS, COMPARISON_STATUS_COLORS } from '@/lib/validations/comparisons';
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { Eye, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ComparisonsListProps {
  comparisons: ComparisonWithRelations[];
  isLoading?: boolean;
  onView: (comparison: ComparisonWithRelations) => void;
  onDelete?: (comparisonId: string) => void;
}

export function ComparisonsList({ 
  comparisons, 
  isLoading, 
  onView,
  onDelete 
}: ComparisonsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (comparisons.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            <p>No hay comparativos creados aún.</p>
            <p className="text-sm mt-1">Crea tu primer comparativo para comenzar.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Ramo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Archivos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((comparison) => (
              <TableRow key={comparison.id} data-testid={`comparison-row-${comparison.id}`}>
                <TableCell className="font-medium">
                  {format(new Date(comparison.created_at), 'dd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell>
                  {comparison.client?.full_name || 'Cliente'}
                </TableCell>
                <TableCell>
                  {POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary"
                    className={COMPARISON_STATUS_COLORS[comparison.status]}
                  >
                    {COMPARISON_STATUS_LABELS[comparison.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {comparison.source_files?.length || 0} archivos
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(comparison)}
                      disabled={comparison.status === 'processing'}
                      data-testid={`view-comparison-${comparison.id}`}
                    >
                      {comparison.status === 'processing' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(comparison.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        data-testid={`delete-comparison-${comparison.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
