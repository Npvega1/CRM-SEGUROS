'use client';

// =====================================================
// COMPONENTE: PaymentModal
// Modal para registrar pago de cuota
// =====================================================

import { useState } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  type InvoiceWithRelations,
  RecordPaymentInputSchema,
  formatCurrency,
  formatDate,
  LINE_LABELS
} from '@/lib/validations/billing';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  invoice: InvoiceWithRelations | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ invoice, open, onClose, onSuccess }: PaymentModalProps) {
  const { tenantId, userId } = useTenant();
  
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('El archivo no puede superar 5MB');
        return;
      }
      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF');
        return;
      }
      setReceiptFile(file);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!invoice || !tenantId) return;
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Validar datos
      const validation = RecordPaymentInputSchema.safeParse({
        invoice_id: invoice.id,
        paid_date: paidDate,
        receipt_url: null,
        notes: notes || null
      });
      
      if (!validation.success) {
        const zodError = validation.error as { errors?: Array<{ message?: string }> };
        setError(zodError.errors?.[0]?.message || 'Datos inválidos');
        setIsSubmitting(false);
        return;
      }
      
      const supabase = getBrowserClient();
      let receiptUrl: string | null = null;
      
      // Subir comprobante si existe
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${tenantId}/${invoice.id}_${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoice-documents')
          .upload(fileName, receiptFile);
        
        if (uploadError) {
          console.error('Error uploading receipt:', uploadError);
          // Continuar sin el comprobante
        } else if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('invoice-documents')
            .getPublicUrl(uploadData.path);
          receiptUrl = urlData.publicUrl;
        }
      }
      
      // Actualizar cuota
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('invoices')
        .update({
          status: 'paid',
          paid_date: paidDate,
          receipt_url: receiptUrl,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id)
        .eq('tenant_id', tenantId);
      
      if (updateError) {
        console.error('Error updating invoice:', updateError);
        setError('Error al registrar el pago');
        setIsSubmitting(false);
        return;
      }
      
      // Registrar en audit_logs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('audit_logs')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          action: 'invoice_paid',
          entity_type: 'invoice',
          entity_id: invoice.id,
          new_values: {
            status: 'paid',
            paid_date: paidDate,
            receipt_url: receiptUrl,
            amount: invoice.amount
          }
        });
      
      // Limpiar y cerrar
      setPaidDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setReceiptFile(null);
      onSuccess();
      
    } catch (err) {
      console.error('Error recording payment:', err);
      setError('Error al registrar el pago');
    }
    
    setIsSubmitting(false);
  };

  const handleClose = () => {
    setPaidDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setReceiptFile(null);
    setError(null);
    onClose();
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Registrar Pago
          </DialogTitle>
          <DialogDescription>
            Registra el pago de la cuota y sube el comprobante si está disponible.
          </DialogDescription>
        </DialogHeader>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {/* Resumen de la cuota */}
          <Card className="bg-slate-50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Cliente</p>
                  <p className="font-medium truncate">{invoice.client?.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Póliza</p>
                  <p className="font-medium truncate">{invoice.policy?.policy_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ramo</p>
                  <p className="font-medium">{LINE_LABELS[invoice.policy?.line || ''] || invoice.policy?.line}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Vencimiento</p>
                  <p className="font-medium">{formatDate(invoice.due_date)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <p className="text-muted-foreground text-sm">Monto a pagar</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(invoice.amount)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Fecha de pago */}
          <div className="space-y-2">
            <Label htmlFor="paid_date">Fecha de Pago *</Label>
            <Input
              id="paid_date"
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              data-testid="paid-date-input"
            />
          </div>

          {/* Comprobante */}
          <div className="space-y-2">
            <Label htmlFor="receipt">Comprobante de Pago (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="receipt"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                data-testid="receipt-file-input"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('receipt')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {receiptFile ? receiptFile.name : 'Seleccionar archivo'}
              </Button>
              {receiptFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceiptFile(null)}
                >
                  Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WEBP, PDF. Máx 5MB.
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Referencia bancaria, observaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              data-testid="notes-input"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !paidDate}
            data-testid="confirm-payment-btn"
          >
            {isSubmitting ? 'Registrando...' : 'Confirmar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentModal;
