'use client';

// =====================================================
// COMPONENTE: KanbanColumn
// Columna del tablero Kanban
// =====================================================

import { useDroppable } from '@dnd-kit/core';
import { OpportunityCard } from './OpportunityCard';
import type { PipelineStage, OpportunityWithRelations } from '@/lib/validations/pipeline';
import { formatPremium } from '@/lib/validations/pipeline';

interface KanbanColumnProps {
  stage: PipelineStage;
  opportunities: OpportunityWithRelations[];
  totalPremium: number;
  count: number;
  onOpportunityClick: (opportunity: OpportunityWithRelations) => void;
}

export function KanbanColumn({
  stage,
  opportunities,
  totalPremium,
  count,
  onOpportunityClick
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-72 rounded-lg transition-colors duration-200
        ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'}
      `}
      data-testid={`kanban-column-${stage.id}`}
    >
      {/* Header de la columna */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-sm truncate" title={stage.name}>
            {stage.name}
          </h3>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full font-medium">
            {count}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatPremium(totalPremium)}
        </p>
      </div>

      {/* Lista de oportunidades */}
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-20rem)] overflow-y-auto">
        {opportunities.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Sin oportunidades
          </div>
        ) : (
          opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              onClick={() => onOpportunityClick(opportunity)}
            />
          ))
        )}
      </div>
    </div>
  );
}
