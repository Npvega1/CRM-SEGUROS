'use client';

// =====================================================
// COMPONENTE: PolicyStatusStepper
// Visualización y control del flujo de estados
// =====================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type PolicyStatus,
  POLICY_STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition
} from '@/lib/validations/policies';
import { Check, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PolicyStatusStepperProps {
  currentStatus: PolicyStatus;
  onStatusChange?: (newStatus: PolicyStatus, note?: string) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean;
}

const STATUS_ORDER: PolicyStatus[] = ['cotizacion', 'activa', 'renovacion', 'renovada', 'vencida', 'cancelada'];

const STATUS_COLORS: Record<PolicyStatus, { bg: string; text: string; border: string }> = {
  cotizacion: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  activa: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' },
  vencida: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' },
  cancelada: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-500' },
  renovacion: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' },
  renovada: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' }
};

export function PolicyStatusStepper({
  currentStatus,
  onStatusChange,
  isLoading = false,
  readOnly = false
}: PolicyStatusStepperProps) {
  const [selectedStatus, setSelectedStatus] = useState<PolicyStatus | null>(null);
  const [note, setNote] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const availableTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

  const handleStatusClick = (status: PolicyStatus) => {
    if (readOnly || !onStatusChange || status === currentStatus) return;
    if (!isValidStatusTransition(currentStatus, status)) return;

    setSelectedStatus(status);
    setNote('');
    setIsDialogOpen(true);
  };

  const handleConfirmChange = async () => {
    if (!selectedStatus || !onStatusChange) return;

    await onStatusChange(selectedStatus, note || undefined);
    setIsDialogOpen(false);
    setSelectedStatus(null);
    setNote('');
  };

  const getStepState = (status: PolicyStatus): 'completed' | 'current' | 'available' | 'disabled' => {
    if (status === currentStatus) return 'current';
    if (availableTransitions.includes(status)) return 'available';
    if (STATUS_ORDER.indexOf(status) < STATUS_ORDER.indexOf(currentStatus)) return 'completed';
    return 'disabled';
  };

  return (
    <>
      <div className="flex items-center flex-wrap gap-2">
        {STATUS_ORDER.filter(s => s !== 'cancelada').map((status, index) => {
          const state = getStepState(status);
          const colors = STATUS_COLORS[status];
          const isClickable = state === 'available' && !readOnly && onStatusChange;

          return (
            <div key={status} className="flex items-center">
              <button
                onClick={() => handleStatusClick(status)}
                disabled={!isClickable || isLoading}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all',
                  state === 'current' && `${colors.bg} ${colors.text} ${colors.border}`,
                  state === 'completed' && 'bg-green-50 text-green-700 border-green-300',
                  state === 'available' && 'bg-white border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 cursor-pointer',
                  state === 'disabled' && 'bg-muted text-muted-foreground border-transparent cursor-not-allowed',
                  isClickable && 'hover:scale-105'
                )}
              >
                {state === 'completed' && <Check className="h-4 w-4" />}
                <span className="text-sm font-medium">{POLICY_STATUS_LABELS[status]}</span>
              </button>
              {index < STATUS_ORDER.filter(s => s !== 'cancelada').length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
              )}
            </div>
          );
        })}

        {/* Botón de cancelar separado */}
        {availableTransitions.includes('cancelada') && !readOnly && onStatusChange && (
          <button
            onClick={() => handleStatusClick('cancelada')}
            disabled={isLoading}
            className="ml-4 px-3 py-2 rounded-lg border-2 border-dashed border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500 transition-all text-sm font-medium"
          >
            Cancelar Póliza
          </button>
        )}
      </div>

      {/* Diálogo de confirmación */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado de Póliza</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de cambiar el estado de <strong>{POLICY_STATUS_LABELS[currentStatus]}</strong> a <strong>{selectedStatus && POLICY_STATUS_LABELS[selectedStatus]}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Nota (opcional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Agregar una nota sobre este cambio..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmChange} disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cambiando...</>
              ) : (
                'Confirmar Cambio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
