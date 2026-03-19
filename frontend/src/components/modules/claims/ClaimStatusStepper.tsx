'use client';

// =====================================================
// COMPONENTE: ClaimStatusStepper
// Barra visual de progreso entre los 6 estados
// =====================================================

import { Check } from 'lucide-react';
import {
  type ClaimStatus,
  CLAIM_STATUS_ORDER,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_STEPPER_COLORS,
  getStatusIndex
} from '@/lib/validations/claims';

interface ClaimStatusStepperProps {
  currentStatus: ClaimStatus;
  className?: string;
}

export function ClaimStatusStepper({ currentStatus, className = '' }: ClaimStatusStepperProps) {
  const currentIndex = getStatusIndex(currentStatus);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between relative">
        {/* Línea de fondo */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
        
        {/* Línea de progreso */}
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-300"
          style={{ width: `${(currentIndex / (CLAIM_STATUS_ORDER.length - 1)) * 100}%` }}
        />

        {CLAIM_STATUS_ORDER.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const colors = CLAIM_STATUS_STEPPER_COLORS[status];

          return (
            <div key={status} className="flex flex-col items-center relative z-10">
              {/* Círculo del paso */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  transition-all duration-300
                  ${isCompleted ? 'bg-primary text-primary-foreground' : ''}
                  ${isCurrent ? `${colors.bg} text-white ring-4 ring-opacity-30 ${colors.border.replace('border', 'ring')}` : ''}
                  ${!isCompleted && !isCurrent ? 'bg-gray-100 text-gray-400 border-2 border-gray-200' : ''}
                `}
                data-testid={`stepper-step-${status}`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Label del paso */}
              <span
                className={`
                  mt-2 text-xs font-medium text-center max-w-[80px] leading-tight
                  ${isCurrent ? colors.text : ''}
                  ${isCompleted ? 'text-primary' : ''}
                  ${!isCompleted && !isCurrent ? 'text-gray-400' : ''}
                `}
              >
                {CLAIM_STATUS_LABELS[status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
