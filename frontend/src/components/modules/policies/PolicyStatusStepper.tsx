'use client';

// =====================================================
// COMPONENTE: PolicyStatusStepper
// Stepper visual compacto: Activa → Remisión → Recaudada
// =====================================================

import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PolicyStatusStepperProps {
  hasRemision: boolean;
  hasRecaudo: boolean;
}

export function PolicyStatusStepper({
  hasRemision,
  hasRecaudo,
}: PolicyStatusStepperProps) {
  const steps = [
    { label: 'Activa', completed: true },
    { label: 'Remisión', completed: hasRemision },
    { label: 'Recaudada', completed: hasRecaudo },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold',
              step.completed
                ? 'bg-green-50 text-green-700 border-green-400'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            )}
          >
            {step.completed && <Check className="h-3 w-3" />}
            {step.label}
          </div>
          {index < steps.length - 1 && (
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
