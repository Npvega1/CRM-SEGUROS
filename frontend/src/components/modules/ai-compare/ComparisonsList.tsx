'use client';

// =====================================================
// COMPONENTE: ComparisonsList
// Lista de comparativos con indicadores de estado
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
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { Eye, Loader2, Trash2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ComparisonsListProps {
  comparisons: ComparisonWithRelations[];
  isLoading?: boolean;
  onView: (comparison: ComparisonWithRelations) => void;
  onDelete?: (comparisonId: string) => void;
}

// Status configuration
const STATUS_CONFIG = {
  processing: {
    label: 'Procesando',
    icon: Clock,
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    iconClassName: 'animate-pulse'
  },
  ready: {
    label: 'Listo',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 border-green-200',
    iconClassName: ''
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    className: 'bg-red-100 text-red-700 border-red-200',
    iconClassName: ''
  },
  exported: {
    label: 'Exportado',
    icon: CheckCircle2,
    className: 'bg-purple-100 text-purple-700 border-purple-200',
    iconClassName: ''
  }
};

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
              <TableHead>Cliente / Prospecto</TableHead>
              <TableHead>Ramo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Archivos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((comparison) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const compData = comparison as any;
              const displayName = comparison.client?.full_name || compData.prospect_name || 'Sin nombre';
              const isProspect = !comparison.client?.full_name && compData.prospect_name;
              const status = comparison.status as keyof typeof STATUS_CONFIG;
              const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.processing;
              const StatusIcon = statusConfig.icon;
              
              return (
                <TableRow 
                  key={comparison.id} 
                  data-testid={`comparison-row-${comparison.id}`}
                  className={status === 'processing' ? 'bg-blue-50/50' : ''}
                >
                  <TableCell className="font-medium">
                    {format(new Date(comparison.created_at), 'dd MMM yyyy', { locale: es })}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comparison.created_at), 'HH:mm', { locale: es })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{displayName}</span>
                      {isProspect && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          Prospecto
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {POLICY_LINE_LABELS[comparison.line as PolicyLine] || comparison.line}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={`${statusConfig.className} flex items-center gap-1 w-fit`}
                    >
                      <StatusIcon className={`h-3 w-3 ${statusConfig.iconClassName}`} />
                      {statusConfig.label}
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
                        disabled={status === 'processing'}
                        data-testid={`view-comparison-${comparison.id}`}
                        title={status === 'processing' ? 'Procesando...' : 'Ver comparativo'}
                      >
                        {status === 'processing' ? (
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
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
