'use client';

// =====================================================
// COMPONENTE: OpportunityCard
// Tarjeta de oportunidad para el Kanban
// =====================================================

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User } from 'lucide-react';
import type { OpportunityWithRelations } from '@/lib/validations/pipeline';
import { 
  formatPremium, 
  formatDate, 
  getProbabilityColor
} from '@/lib/validations/pipeline';
import { POLICY_LINE_LABELS as LINE_LABELS } from '@/lib/validations/policies';

interface OpportunityCardProps {
  opportunity: OpportunityWithRelations;
  onClick: () => void;
  isDragging?: boolean;
}

export function OpportunityCard({ 
  opportunity, 
  onClick,
  isDragging = false 
}: OpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBeingDragged = isDragging || isSortableDragging;

  // Obtener label del ramo
  const lineLabel = LINE_LABELS[opportunity.line] || opportunity.line;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        p-3 cursor-pointer transition-all duration-200 hover:shadow-md
        ${isBeingDragged ? 'shadow-lg scale-105 opacity-80' : ''}
        touch-none
      `}
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      {/* Nombre del cliente y ramo */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm line-clamp-1" title={opportunity.client?.full_name}>
          {opportunity.client?.full_name || 'Cliente'}
        </h4>
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {lineLabel}
        </Badge>
      </div>

      {/* Prima estimada */}
      <p className="text-lg font-semibold text-primary mb-2">
        {formatPremium(opportunity.estimated_premium)}
      </p>

      {/* Barra de probabilidad */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Probabilidad</span>
          <span className="font-medium">{opportunity.close_probability}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getProbabilityColor(opportunity.close_probability)}`}
            style={{ width: `${opportunity.close_probability}%` }}
          />
        </div>
      </div>

      {/* Fecha esperada y agente */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(opportunity.expected_close_date)}</span>
        </div>
        
        {opportunity.agent && (
          <div className="flex items-center gap-1">
            {opportunity.agent.avatar_url ? (
              <img
                src={opportunity.agent.avatar_url}
                alt={opportunity.agent.full_name}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-3 w-3 text-primary" />
              </div>
            )}
            <span className="truncate max-w-[80px]" title={opportunity.agent.full_name}>
              {opportunity.agent.full_name.split(' ')[0]}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
