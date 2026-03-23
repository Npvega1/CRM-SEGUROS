'use client';

// =====================================================
// COMPONENTE: ClaimTimeline
// Línea de tiempo cronológica de cambios de estado
// =====================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight,
  MessageSquare,
  Lock,
  Plus,
  User
} from 'lucide-react';
import {
  type ClaimHistory,
  type ClaimStatus,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  formatClaimDateTime,
  getValidTransitions
} from '@/lib/validations/claims';

interface ClaimTimelineProps {
  history: ClaimHistory[];
  currentStatus: ClaimStatus;
  onStatusChange: (newStatus: ClaimStatus, comment: string) => Promise<void>;
  isUpdating?: boolean;
}

export function ClaimTimeline({
  history,
  currentStatus,
  onStatusChange,
  isUpdating = false
}: ClaimTimelineProps) {
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [newStatus, setNewStatus] = useState<ClaimStatus | ''>('');
  const [comment, setComment] = useState('');

  const validTransitions = getValidTransitions(currentStatus);

  const handleSubmit = async () => {
    if (!newStatus) return;
    
    await onStatusChange(newStatus, comment);
    
    // Reset form
    setShowChangeForm(false);
    setNewStatus('');
    setComment('');
  };

  return (
    <div className="space-y-4">
      {/* Botón para cambiar estado */}
      {validTransitions.length > 0 && (
        <Button
          variant={showChangeForm ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowChangeForm(!showChangeForm)}
          className="w-full"
          data-testid="change-status-btn"
        >
          <Plus className="h-4 w-4 mr-1" />
          {showChangeForm ? 'Cancelar' : 'Cambiar Estado'}
        </Button>
      )}

      {/* Formulario de cambio de estado */}
      {showChangeForm && (
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border" data-testid="status-change-form">
          <div className="space-y-2">
            <Label htmlFor="new-status">Nuevo Estado *</Label>
            <Select
              value={newStatus}
              onValueChange={(v) => setNewStatus(v as ClaimStatus)}
            >
              <SelectTrigger id="new-status" data-testid="new-status-select">
                <SelectValue placeholder="Seleccionar estado..." />
              </SelectTrigger>
              <SelectContent>
                {validTransitions.map(status => (
                  <SelectItem key={status} value={status}>
                    {CLAIM_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comentario</Label>
            <Textarea
              id="comment"
              placeholder="Agregar notas o comentarios..."
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              data-testid="status-comment-input"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!newStatus || isUpdating}
            className="w-full"
            data-testid="submit-status-change"
          >
            {isUpdating ? 'Actualizando...' : 'Actualizar Estado'}
          </Button>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay historial registrado
          </p>
        ) : (
          <div className="space-y-0">
            {history.map((entry, index) => (
              <div
                key={entry.id}
                className="relative pl-8 pb-4"
                data-testid={`history-item-${entry.id}`}
              >
                {/* Línea vertical */}
                {index < history.length - 1 && (
                  <div className="absolute left-[11px] top-6 w-0.5 h-full bg-border" />
                )}

                {/* Icono */}
                <div
                  className={`
                    absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center
                    ${entry.is_internal ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'}
                  `}
                >
                  {entry.is_internal ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <MessageSquare className="h-3 w-3" />
                  )}
                </div>

                {/* Contenido */}
                <div
                  className={`
                    bg-card border rounded-lg p-3
                    ${entry.is_internal ? 'bg-gray-50 border-gray-200' : 'bg-blue-50/30 border-blue-100'}
                  `}
                >
                  {/* Cambio de estado */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.old_status ? (
                      <>
                        <span className={`px-2 py-0.5 rounded text-xs ${CLAIM_STATUS_COLORS[entry.old_status]}`}>
                          {CLAIM_STATUS_LABELS[entry.old_status]}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Creado como</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs ${CLAIM_STATUS_COLORS[entry.new_status]}`}>
                      {CLAIM_STATUS_LABELS[entry.new_status]}
                    </span>
                  </div>

                  {/* Comentario */}
                  {entry.comment && (
                    <p className="text-sm mt-2 text-foreground">
                      {entry.comment}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {entry.changed_by_name || 'Sistema'}
                    </span>
                    <span>{formatClaimDateTime(entry.changed_at)}</span>
                    {entry.is_internal && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Lock className="h-3 w-3" />
                        Interno
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
