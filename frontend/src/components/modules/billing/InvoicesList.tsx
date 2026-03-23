'use client';

// =====================================================
// COMPONENTE: InvoicesList
// Lista de cuotas con filtros y acciones
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaymentModal } from './PaymentModal';
import {
  type InvoiceWithRelations,
  type InvoiceStatus,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  LINE_LABELS,
  formatCurrency,
  formatDate,
  getDaysUntilDue
} from '@/lib/validations/billing';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CreditCard,
  Eye,
  AlertCircle
} from 'lucide-react';

interface InvoicesListProps {
  onUpdate?: () => void;
}

export function InvoicesList({ onUpdate }: InvoicesListProps) {
  const { tenantId } = useTenant();
  
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Modal de pago
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithRelations | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      let query = supabase
        .from('invoices')
        .select(`
          *,
          policies!inner(id, policy_number, insurer, line),
          clients!inner(id, full_name, email, phone)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      // Aplicar filtros
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      if (lineFilter && lineFilter !== 'all') {
        query = query.eq('policies.line', lineFilter);
      }
      
      if (dateFrom) {
        query = query.gte('due_date', dateFrom);
      }
      
      if (dateTo) {
        query = query.lte('due_date', dateTo);
      }
      
      const { data, count, error } = await query;
      
      if (error) {
        console.error('Error loading invoices:', error);
      } else {
        // Mapear datos con relaciones
        const mapped = (data || []).map((inv: Record<string, unknown>) => ({
          ...inv,
          policy: inv.policies as { id: string; policy_number: string; insurer: string; line: string },
          client: inv.clients as { id: string; full_name: string; email: string | null; phone: string | null }
        })) as InvoiceWithRelations[];
        
        // Filtrar por búsqueda en cliente/póliza
        const filtered = searchQuery 
          ? mapped.filter(inv => 
              inv.client?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              inv.policy?.policy_number.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : mapped;
        
        setInvoices(filtered);
        setTotal(count || 0);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
    setIsLoading(false);
  }, [tenantId, page, pageSize, statusFilter, lineFilter, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    if (tenantId) {
      loadInvoices();
    }
  }, [tenantId, loadInvoices]);

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    loadInvoices();
    onUpdate?.();
  };

  const openPaymentModal = (invoice: InvoiceWithRelations) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  const getDaysLabel = (dueDate: string, status: InvoiceStatus) => {
    if (status === 'paid' || status === 'waived') return null;
    
    const days = getDaysUntilDue(dueDate);
    if (days < 0) {
      return (
        <span className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Vencida hace {Math.abs(days)} días
        </span>
      );
    }
    if (days === 0) {
      return <span className="text-xs text-yellow-600">Vence hoy</span>;
    }
    if (days <= 7) {
      return <span className="text-xs text-yellow-600">Vence en {days} días</span>;
    }
    return <span className="text-xs text-muted-foreground">Vence en {days} días</span>;
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente o número de póliza..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-invoices-input"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="status-filter">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={lineFilter} onValueChange={setLineFilter}>
              <SelectTrigger className="w-[150px]" data-testid="line-filter">
                <SelectValue placeholder="Ramo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(LINE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="Desde"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                data-testid="date-from"
              />
              <Input
                type="date"
                placeholder="Hasta"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                data-testid="date-to"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Cuotas por Cobrar
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Receipt className="h-12 w-12 mb-4 opacity-50" />
              <p>No se encontraron cuotas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Ramo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Cuota</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                      <TableCell>
                        <Link 
                          href={`/clientes/${invoice.client_id}`}
                          className="hover:underline font-medium"
                        >
                          {invoice.client?.full_name || 'N/A'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          href={`/polizas/${invoice.policy_id}`}
                          className="hover:underline"
                        >
                          {invoice.policy?.policy_number || 'N/A'}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {invoice.policy?.insurer}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {LINE_LABELS[invoice.policy?.line || ''] || invoice.policy?.line || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{formatDate(invoice.due_date)}</p>
                          {getDaysLabel(invoice.due_date, invoice.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {invoice.installment_number} de {invoice.total_installments}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openPaymentModal(invoice)}
                              data-testid={`pay-invoice-${invoice.id}`}
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                          <Link href={`/polizas/${invoice.policy_id}`}>
                            <Button variant="ghost" size="sm" data-testid={`view-policy-${invoice.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Pago */}
      <PaymentModal
        invoice={selectedInvoice}
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedInvoice(null);
        }}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

export default InvoicesList;
