'use client';

// =====================================================
// PÁGINA: Estado de Cuenta del Portal
// Módulo 07: Portal del Cliente
// Lista de cuotas por póliza
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { usePortal } from '@/lib/context/PortalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPortalDate, formatPortalCurrency } from '@/lib/validations/portal';
import {
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  Building2
} from 'lucide-react';

// Tipos
interface Invoice {
  id: string;
  policy_id: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  paid_date: string | null;
  installment_number: number;
  total_installments: number;
}

interface PolicyWithInvoices {
  id: string;
  policy_number: string;
  insurer: string;
  line: string;
  invoices: Invoice[];
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
}

// Labels y colores
const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  overdue: 'Vencida',
  waived: 'Condonada'
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-300',
  paid: 'bg-green-100 text-green-800 border-green-300',
  overdue: 'bg-red-100 text-red-800 border-red-300',
  waived: 'bg-blue-100 text-blue-800 border-blue-300'
};

const POLICY_LINE_LABELS: Record<string, string> = {
  vida: 'Vida',
  auto: 'Auto',
  salud: 'Salud',
  hogar: 'Hogar',
  soat: 'SOAT',
  otro: 'Otro'
};

export default function PortalAccountPage() {
  const params = useParams();
  const tenantSlug = params?.tenantSlug as string;
  const { client } = usePortal();

  const [policiesWithInvoices, setPoliciesWithInvoices] = useState<PolicyWithInvoices[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Cargar cuotas agrupadas por póliza
  useEffect(() => {
    async function loadInvoices() {
      if (!client.client_id || !client.tenant_id) return;

      try {
        // Cargar pólizas con cuotas
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select(`
            id,
            policy_id,
            amount,
            due_date,
            status,
            paid_date,
            installment_number,
            total_installments,
            policy:policies(id, policy_number, insurer, line)
          `)
          .eq('tenant_id', client.tenant_id)
          .eq('client_id', client.client_id)
          .order('due_date', { ascending: true });

        if (error) throw error;

        // Agrupar por póliza
        const grouped: Record<string, PolicyWithInvoices> = {};
        
        (invoices || []).forEach((inv: Record<string, unknown>) => {
          const policy = inv.policy as { id: string; policy_number: string; insurer: string; line: string } | null;
          if (!policy) return;

          if (!grouped[policy.id]) {
            grouped[policy.id] = {
              id: policy.id,
              policy_number: policy.policy_number,
              insurer: policy.insurer,
              line: policy.line,
              invoices: [],
              totalAmount: 0,
              totalPaid: 0,
              totalPending: 0
            };
          }

          const invoice: Invoice = {
            id: inv.id as string,
            policy_id: inv.policy_id as string,
            amount: inv.amount as number,
            due_date: inv.due_date as string,
            status: inv.status as Invoice['status'],
            paid_date: inv.paid_date as string | null,
            installment_number: inv.installment_number as number,
            total_installments: inv.total_installments as number
          };

          grouped[policy.id].invoices.push(invoice);
          grouped[policy.id].totalAmount += invoice.amount;
          
          if (invoice.status === 'paid') {
            grouped[policy.id].totalPaid += invoice.amount;
          } else if (invoice.status === 'pending' || invoice.status === 'overdue') {
            grouped[policy.id].totalPending += invoice.amount;
          }
        });

        setPoliciesWithInvoices(Object.values(grouped));
      } catch (e) {
        console.error('Error loading invoices:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadInvoices();
  }, [supabase, client.client_id, client.tenant_id]);

  // Calcular totales generales
  const totals = useMemo(() => {
    return policiesWithInvoices.reduce((acc, policy) => ({
      totalAmount: acc.totalAmount + policy.totalAmount,
      totalPaid: acc.totalPaid + policy.totalPaid,
      totalPending: acc.totalPending + policy.totalPending
    }), { totalAmount: 0, totalPaid: 0, totalPending: 0 });
  }, [policiesWithInvoices]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6" data-testid="portal-account-loading">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="portal-account">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estado de Cuenta</h1>
        <p className="text-muted-foreground">
          Consulta tus cuotas pendientes y pagos realizados
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-700">Total Pagado</p>
                <p className="text-xl font-bold text-green-800">
                  {formatPortalCurrency(totals.totalPaid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-orange-700">Pendiente</p>
                <p className="text-xl font-bold text-orange-800">
                  {formatPortalCurrency(totals.totalPending)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatPortalCurrency(totals.totalAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sin cuotas */}
      {policiesWithInvoices.length === 0 && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No tienes cuotas registradas</h3>
            <p className="text-muted-foreground mt-1">
              Las cuotas aparecerán aquí cuando tengas pólizas activas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cuotas por póliza */}
      {policiesWithInvoices.map(policy => (
        <Card key={policy.id} data-testid={`policy-invoices-${policy.id}`}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {POLICY_LINE_LABELS[policy.line] || policy.line}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {policy.insurer} - {policy.policy_number}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Pendiente</p>
                <p className={`font-semibold ${policy.totalPending > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {formatPortalCurrency(policy.totalPending)}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {policy.invoices.map(invoice => (
                <div 
                  key={invoice.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    invoice.status === 'overdue' ? 'bg-red-50 border-red-200' :
                    invoice.status === 'paid' ? 'bg-green-50 border-green-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                  data-testid={`invoice-${invoice.id}`}
                >
                  <div className="flex items-center gap-3">
                    {invoice.status === 'paid' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : invoice.status === 'overdue' ? (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">
                        Cuota {invoice.installment_number} de {invoice.total_installments}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {invoice.status === 'paid' && invoice.paid_date ? (
                          <span>Pagada el {formatPortalDate(invoice.paid_date)}</span>
                        ) : (
                          <span>Vence: {formatPortalDate(invoice.due_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${
                      invoice.status === 'paid' ? 'text-green-700' :
                      invoice.status === 'overdue' ? 'text-red-700' :
                      'text-gray-900'
                    }`}>
                      {formatPortalCurrency(invoice.amount)}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={INVOICE_STATUS_COLORS[invoice.status]}
                    >
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Información de pago */}
      {totals.totalPending > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Receipt className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-900">
                  ¿Cómo realizar el pago?
                </h3>
                <p className="text-sm text-blue-800 mt-1">
                  Contacta a tu agente de seguros para obtener información sobre los 
                  métodos de pago disponibles y procesar tus cuotas pendientes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
