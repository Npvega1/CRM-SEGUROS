'use client';

// =====================================================
// COMPONENTE: AutomationLogs
// Tabla de historial de ejecuciones
// =====================================================

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import {
  type LogStatus,
  LOG_STATUS_LABELS,
  LOG_STATUS_COLORS,
  ACTION_TYPE_LABELS,
  formatDateTime
} from '@/lib/validations/automations';

interface AutomationLogsProps {
  automationId: string;
}

interface LogItem {
  id: string;
  tenant_id: string;
  automation_id: string | null;
  queue_id: string | null;
  action_id: string | null;
  status: LogStatus;
  response: Record<string, unknown> | null;
  error_msg: string | null;
  executed_at: string;
  action_type?: string;
}

export function AutomationLogs({ automationId }: AutomationLogsProps) {
  const { tenantId } = useTenant();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const supabase = getBrowserClient();

  const loadLogs = async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      // Cargar logs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: logsData, error } = await (supabase as any)
        .from('automation_logs_v2')
        .select('*')
        .eq('automation_id', automationId)
        .order('executed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Cargar tipos de acción para cada log
      const logsWithDetails = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (logsData || []).map(async (log: Record<string, unknown>) => {
          let actionType = undefined;
          if (log.action_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: actionData } = await (supabase as any)
              .from('automation_actions')
              .select('action_type')
              .eq('id', log.action_id)
              .single();
            actionType = actionData?.action_type;
          }
          return {
            ...log,
            status: log.status as LogStatus,
            response: log.response as Record<string, unknown> | null,
            action_type: actionType
          } as LogItem;
        })
      );

      setLogs(logsWithDetails);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [automationId, tenantId]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Sin ejecuciones</h3>
        <p className="text-muted-foreground">
          Esta automatización aún no ha sido ejecutada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando las últimas {logs.length} ejecuciones
        </p>
        <Button variant="outline" size="sm" onClick={loadLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <>
                <TableRow 
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleRow(log.id)}
                  data-testid={`log-row-${log.id}`}
                >
                  <TableCell>
                    {expandedRows.has(log.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDateTime(log.executed_at)}
                  </TableCell>
                  <TableCell>
                    {log.action_type ? (
                      <Badge variant="outline">
                        {ACTION_TYPE_LABELS[log.action_type as keyof typeof ACTION_TYPE_LABELS] || log.action_type}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={LOG_STATUS_COLORS[log.status]}>
                      {log.status === 'success' ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {LOG_STATUS_LABELS[log.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.error_msg || (log.response ? 'Ver detalles' : '-')}
                  </TableCell>
                </TableRow>

                {/* Fila expandida con detalles */}
                {expandedRows.has(log.id) && (
                  <TableRow key={`${log.id}-details`}>
                    <TableCell colSpan={5} className="bg-muted/30 p-4">
                      <div className="space-y-3">
                        {log.error_msg && (
                          <div>
                            <p className="text-sm font-medium text-red-600 mb-1">Error:</p>
                            <pre className="text-sm bg-red-50 text-red-800 p-3 rounded-lg whitespace-pre-wrap">
                              {log.error_msg}
                            </pre>
                          </div>
                        )}

                        {log.response && Object.keys(log.response).length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">Respuesta:</p>
                            <pre className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">ID del log:</span>
                            <span className="ml-2 font-mono text-xs">{log.id}</span>
                          </div>
                          {log.queue_id && (
                            <div>
                              <span className="text-muted-foreground">ID de cola:</span>
                              <span className="ml-2 font-mono text-xs">{log.queue_id}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
