'use client';

// =====================================================
// COMPONENTE: EmailSendLogs
// Historial de emails enviados manualmente
// =====================================================

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Mail,
  User,
  Users,
  Filter
} from 'lucide-react';

interface EmailLog {
  id: string;
  tenant_id: string;
  template_id: string | null;
  template_name: string | null;
  subject: string;
  recipient_type: 'client' | 'ally' | 'both';
  recipient_email: string;
  recipient_name: string | null;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  sent_at: string;
  created_at: string;
}

const STATUS_CONFIG = {
  sent: { label: 'Enviado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: 'Fallido', color: 'bg-red-100 text-red-800', icon: XCircle },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
};

const RECIPIENT_TYPE_LABELS = {
  client: 'Cliente',
  ally: 'Aliado',
  both: 'Ambos',
};

export function EmailSendLogs() {
  const { tenantId } = useTenant();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');

  const supabase = getBrowserClient();

  const loadLogs = async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('email_send_logs')
        .select(`
          *,
          email_templates (name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedLogs: EmailLog[] = (data || []).map((log: any) => ({
        ...log,
        template_name: log.email_templates?.name || null,
      }));

      setLogs(formattedLogs);
    } catch (err) {
      console.error('Error loading email logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [tenantId]);

  // Filtrar logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm === '' ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.recipient_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.recipient_name && log.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesRecipient = recipientFilter === 'all' || log.recipient_type === recipientFilter;

    return matchesSearch && matchesStatus && matchesRecipient;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Estadísticas
  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === 'sent').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    pending: logs.filter((l) => l.status === 'pending').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-send-logs">
      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Total Enviados</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Exitosos</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Fallidos</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por asunto, email o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-logs-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="failed">Fallidos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recipientFilter} onValueChange={setRecipientFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="recipient-filter">
            <Users className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Destinatario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="client">Clientes</SelectItem>
            <SelectItem value="ally">Aliados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadLogs} data-testid="refresh-logs-btn">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Tabla */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay registros</h3>
          <p className="text-muted-foreground">
            {logs.length === 0
              ? 'Aún no se han enviado emails desde esta cuenta'
              : 'No se encontraron resultados con los filtros aplicados'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Plantilla</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const StatusIcon = STATUS_CONFIG[log.status].icon;
                return (
                  <TableRow key={log.id} data-testid={`email-log-row-${log.id}`}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[200px]">
                          {log.recipient_name || 'Sin nombre'}
                        </span>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {log.recipient_email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {log.subject}
                    </TableCell>
                    <TableCell>
                      {log.template_name ? (
                        <Badge variant="outline">{log.template_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {log.recipient_type === 'client' ? (
                          <User className="h-3 w-3 mr-1" />
                        ) : (
                          <Users className="h-3 w-3 mr-1" />
                        )}
                        {RECIPIENT_TYPE_LABELS[log.recipient_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[log.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {STATUS_CONFIG[log.status].label}
                      </Badge>
                      {log.error_message && (
                        <p className="text-xs text-red-600 mt-1 max-w-[150px] truncate" title={log.error_message}>
                          {log.error_message}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Info de paginación */}
      {filteredLogs.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Mostrando {filteredLogs.length} de {logs.length} registros
        </p>
      )}
    </div>
  );
}
