'use client';

// =====================================================
// COMPONENTE: KanbanBoard
// Tablero Kanban con drag-and-drop para pipeline de ventas
// =====================================================

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { OpportunityCard } from './OpportunityCard';
import { LoseOpportunityModal } from './LoseOpportunityModal';
import { WinOpportunityModal } from './WinOpportunityModal';
import type { 
  PipelineStage, 
  OpportunityWithRelations,
  KanbanColumn as KanbanColumnType 
} from '@/lib/validations/pipeline';

interface KanbanBoardProps {
  stages: PipelineStage[];
  opportunities: OpportunityWithRelations[];
  onMoveOpportunity: (opportunityId: string, newStageId: string) => Promise<void>;
  onWinOpportunity: (opportunityId: string, data: { policy_number?: string; commission_pct?: number }) => Promise<void>;
  onLoseOpportunity: (opportunityId: string, reason: string) => Promise<void>;
  onOpportunityClick: (opportunity: OpportunityWithRelations) => void;
  isLoading?: boolean;
}

export function KanbanBoard({
  stages,
  opportunities,
  onMoveOpportunity,
  onWinOpportunity,
  onLoseOpportunity,
  onOpportunityClick,
  isLoading = false
}: KanbanBoardProps) {
  const [activeOpportunity, setActiveOpportunity] = useState<OpportunityWithRelations | null>(null);
  const [loseModalOpen, setLoseModalOpen] = useState(false);
  const [winModalOpen, setWinModalOpen] = useState(false);
  const [pendingMoveOpportunity, setPendingMoveOpportunity] = useState<OpportunityWithRelations | null>(null);

  // Encontrar etapas especiales
  const wonStage = useMemo(() => 
    stages.find(s => s.name.toLowerCase().includes('ganado')),
    [stages]
  );
  const lostStage = useMemo(() => 
    stages.find(s => s.name.toLowerCase().includes('perdido')),
    [stages]
  );

  // Organizar oportunidades por etapa
  const columns: KanbanColumnType[] = useMemo(() => {
    return stages.map(stage => {
      const stageOpportunities = opportunities.filter(
        opp => opp.stage_id === stage.id && opp.status === 'active'
      );
      return {
        stage,
        opportunities: stageOpportunities,
        totalPremium: stageOpportunities.reduce((sum, opp) => sum + opp.estimated_premium, 0),
        count: stageOpportunities.length
      };
    });
  }, [stages, opportunities]);

  // Configurar sensores para drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const opportunity = opportunities.find(opp => opp.id === active.id);
    if (opportunity) {
      setActiveOpportunity(opportunity);
    }
  }, [opportunities]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Podemos agregar efectos visuales aquí si es necesario
    void event;
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOpportunity(null);

    if (!over) return;

    const opportunityId = active.id as string;
    const opportunity = opportunities.find(opp => opp.id === opportunityId);
    if (!opportunity) return;

    // Determinar la etapa destino
    let targetStageId: string;
    
    // Si se suelta sobre otra oportunidad, obtener su etapa
    const overOpportunity = opportunities.find(opp => opp.id === over.id);
    if (overOpportunity) {
      targetStageId = overOpportunity.stage_id;
    } else {
      // Se soltó directamente sobre una columna
      targetStageId = over.id as string;
    }

    // Si no cambió de etapa, no hacer nada
    if (opportunity.stage_id === targetStageId) return;

    // Verificar si es etapa especial
    if (wonStage && targetStageId === wonStage.id) {
      setPendingMoveOpportunity(opportunity);
      setWinModalOpen(true);
      return;
    }

    if (lostStage && targetStageId === lostStage.id) {
      setPendingMoveOpportunity(opportunity);
      setLoseModalOpen(true);
      return;
    }

    // Mover normalmente
    await onMoveOpportunity(opportunityId, targetStageId);
  }, [opportunities, wonStage, lostStage, onMoveOpportunity]);

  const handleWinConfirm = async (data: { policy_number?: string; commission_pct?: number }) => {
    if (pendingMoveOpportunity) {
      await onWinOpportunity(pendingMoveOpportunity.id, data);
      setWinModalOpen(false);
      setPendingMoveOpportunity(null);
    }
  };

  const handleLoseConfirm = async (reason: string) => {
    if (pendingMoveOpportunity) {
      await onLoseOpportunity(pendingMoveOpportunity.id, reason);
      setLoseModalOpen(false);
      setPendingMoveOpportunity(null);
    }
  };

  const handleModalCancel = () => {
    setWinModalOpen(false);
    setLoseModalOpen(false);
    setPendingMoveOpportunity(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div 
          className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-16rem)]"
          data-testid="kanban-board"
        >
          {columns.map((column) => (
            <SortableContext
              key={column.stage.id}
              id={column.stage.id}
              items={column.opportunities.map(o => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                stage={column.stage}
                opportunities={column.opportunities}
                totalPremium={column.totalPremium}
                count={column.count}
                onOpportunityClick={onOpportunityClick}
              />
            </SortableContext>
          ))}
        </div>

        <DragOverlay>
          {activeOpportunity ? (
            <div className="rotate-3 opacity-90">
              <OpportunityCard
                opportunity={activeOpportunity}
                onClick={() => {}}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal para perder oportunidad */}
      <LoseOpportunityModal
        open={loseModalOpen}
        opportunity={pendingMoveOpportunity}
        onConfirm={handleLoseConfirm}
        onCancel={handleModalCancel}
      />

      {/* Modal para ganar oportunidad */}
      <WinOpportunityModal
        open={winModalOpen}
        opportunity={pendingMoveOpportunity}
        onConfirm={handleWinConfirm}
        onCancel={handleModalCancel}
      />
    </>
  );
}

// =====================================================
// COMPONENTE: KanbanBoardSkeleton
// Skeleton para carga del tablero
// =====================================================
export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex-shrink-0 w-72 bg-muted/30 rounded-lg p-3 animate-pulse"
        >
          <div className="h-6 bg-muted rounded w-24 mb-2"></div>
          <div className="h-4 bg-muted rounded w-16 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
