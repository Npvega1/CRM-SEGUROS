'use client';

// =====================================================
// COMPONENTE: LoseOpportunityModal
// Modal para marcar oportunidad como perdida
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import type { OpportunityWithRelations } from '@/lib/validations/pipeline';
import { formatPremium } from '@/lib/validations/pipeline';

interface LoseOpportunityModalProps {
  open: boolean;
  opportunity: OpportunityWithRelations | null;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export function LoseOpportunityModal({
  open,
  opportunity,
  onConfirm,
  onCancel
}: LoseOpportunityModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('La razón de pérdida es obligatoria');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(reason.trim());
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    setError(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-md" data-testid="lose-opportunity-modal">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Marcar como Perdida</DialogTitle>
          </div>
          <DialogDescription>
            Esta oportunidad será marcada como perdida y no podrá ser modificada.
          </DialogDescription>
        </DialogHeader>

        {opportunity && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium">{opportunity.client?.full_name}</p>
            <p className="text-muted-foreground">
              Prima: {formatPremium(opportunity.estimated_premium)}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="lost-reason">
            Razón de pérdida <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="lost-reason"
            placeholder="Ej: El cliente eligió otra aseguradora por precio..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
            data-testid="lost-reason-input"
          />
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting || !reason.trim()}
            data-testid="confirm-lose-btn"
          >
            {isSubmitting ? 'Guardando...' : 'Confirmar Pérdida'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
