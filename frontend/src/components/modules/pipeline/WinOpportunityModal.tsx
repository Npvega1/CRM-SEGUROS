'use client';

// =====================================================
// COMPONENTE: WinOpportunityModal
// Modal para confirmar oportunidad ganada
// =====================================================

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, CheckCircle2 } from 'lucide-react';
import type { OpportunityWithRelations } from '@/lib/validations/pipeline';
import { formatPremium } from '@/lib/validations/pipeline';
import { POLICY_LINE_LABELS } from '@/lib/validations/policies';

interface WinOpportunityModalProps {
  open: boolean;
  opportunity: OpportunityWithRelations | null;
  onConfirm: (data: { policy_number?: string; commission_pct?: number }) => Promise<void>;
  onCancel: () => void;
}

export function WinOpportunityModal({
  open,
  opportunity,
  onConfirm,
  onCancel
}: WinOpportunityModalProps) {
  const [policyNumber, setPolicyNumber] = useState('');
  const [commissionPct, setCommissionPct] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm({
        policy_number: policyNumber.trim() || undefined,
        commission_pct: parseFloat(commissionPct) || 10
      });
      setPolicyNumber('');
      setCommissionPct('10');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPolicyNumber('');
    setCommissionPct('10');
    setError(null);
    onCancel();
  };

  const lineLabel = opportunity ? POLICY_LINE_LABELS[opportunity.line] : '';
  const estimatedCommission = opportunity 
    ? (opportunity.estimated_premium * (parseFloat(commissionPct) || 0) / 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-md" data-testid="win-opportunity-modal">
        <DialogHeader>
          <div className="flex items-center gap-2 text-green-600">
            <Trophy className="h-5 w-5" />
            <DialogTitle>¡Oportunidad Ganada!</DialogTitle>
          </div>
          <DialogDescription>
            Se creará una póliza automáticamente con los datos de esta oportunidad.
          </DialogDescription>
        </DialogHeader>

        {opportunity && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Resumen de la venta</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium">{opportunity.client?.full_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ramo</p>
                <p className="font-medium">{lineLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Prima</p>
                <p className="font-medium text-green-700 dark:text-green-400">
                  {formatPremium(opportunity.estimated_premium)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Comisión estimada</p>
                <p className="font-medium">
                  {formatPremium(estimatedCommission)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="policy-number">
              Número de Póliza <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="policy-number"
              placeholder="Se generará automáticamente si está vacío"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value.toUpperCase())}
              data-testid="policy-number-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commission-pct">Porcentaje de Comisión (%)</Label>
            <Input
              id="commission-pct"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              data-testid="commission-pct-input"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
            data-testid="confirm-win-btn"
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar y Crear Póliza'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
