'use client';

// =====================================================
// COMPONENTE: ActivityTimeline
// Línea de tiempo de actividades
// =====================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Phone, 
  Mail, 
  Users, 
  CheckSquare, 
  FileText,
  Plus,
  Check,
  Clock
} from 'lucide-react';
import type { Activity, ActivityType, CreateActivityInput } from '@/lib/validations/pipeline';
import { 
  formatDateTime,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS
} from '@/lib/validations/pipeline';

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Users className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />
};

interface ActivityTimelineProps {
  activities: Activity[];
  opportunityId: string;
  clientId: string;
  onCreateActivity: (data: CreateActivityInput) => Promise<void>;
  onCompleteActivity: (activityId: string) => Promise<void>;
}

export function ActivityTimeline({
  activities,
  opportunityId,
  clientId,
  onCreateActivity,
  onCompleteActivity
}: ActivityTimelineProps) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    type: ActivityType;
    subject: string;
    description: string;
    scheduled_at: string;
  }>({
    type: 'call',
    subject: '',
    description: '',
    scheduled_at: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateActivity({
        opportunity_id: opportunityId,
        client_id: clientId,
        type: formData.type,
        subject: formData.subject.trim(),
        description: formData.description.trim() || null,
        scheduled_at: formData.scheduled_at || null
      });
      setFormData({ type: 'call', subject: '', description: '', scheduled_at: '' });
      setShowForm(false);
    } catch (e) {
      console.error('Error creating activity:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (activityId: string) => {
    try {
      await onCompleteActivity(activityId);
    } catch (e) {
      console.error('Error completing activity:', e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Botón para agregar actividad */}
      <Button
        variant={showForm ? "secondary" : "outline"}
        size="sm"
        onClick={() => setShowForm(!showForm)}
        className="w-full"
        data-testid="add-activity-btn"
      >
        <Plus className="h-4 w-4 mr-1" />
        {showForm ? 'Cancelar' : 'Nueva Actividad'}
      </Button>

      {/* Formulario inline */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="activity-type" className="text-xs">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  type: value as ActivityType 
                }))}
              >
                <SelectTrigger id="activity-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map(type => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        {ACTIVITY_ICONS[type]}
                        {ACTIVITY_TYPE_LABELS[type]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="activity-scheduled" className="text-xs">Programada para</Label>
              <Input
                id="activity-scheduled"
                type="datetime-local"
                className="h-9"
                value={formData.scheduled_at}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="activity-subject" className="text-xs">Asunto *</Label>
            <Input
              id="activity-subject"
              placeholder="Ej: Llamada de seguimiento"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              data-testid="activity-subject-input"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="activity-description" className="text-xs">Descripción</Label>
            <Textarea
              id="activity-description"
              placeholder="Detalles adicionales..."
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <Button 
            type="submit" 
            size="sm" 
            disabled={isSubmitting || !formData.subject.trim()}
            data-testid="save-activity-btn"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Actividad'}
          </Button>
        </form>
      )}

      {/* Timeline de actividades */}
      <div className="relative">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay actividades registradas
          </p>
        ) : (
          <div className="space-y-0">
            {activities.map((activity, index) => (
              <div 
                key={activity.id} 
                className="relative pl-8 pb-4"
                data-testid={`activity-item-${activity.id}`}
              >
                {/* Línea vertical */}
                {index < activities.length - 1 && (
                  <div className="absolute left-[11px] top-6 w-0.5 h-full bg-border" />
                )}

                {/* Icono del tipo */}
                <div 
                  className={`
                    absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center
                    ${activity.completed_at ? 'bg-green-100 text-green-700' : ACTIVITY_TYPE_COLORS[activity.type]}
                  `}
                >
                  {activity.completed_at ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    ACTIVITY_ICONS[activity.type]
                  )}
                </div>

                {/* Contenido */}
                <div className="bg-card border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{activity.subject}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className={`px-1.5 py-0.5 rounded ${ACTIVITY_TYPE_COLORS[activity.type]}`}>
                          {ACTIVITY_TYPE_LABELS[activity.type]}
                        </span>
                        {activity.scheduled_at && !activity.completed_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(activity.scheduled_at)}
                          </span>
                        )}
                        {activity.completed_at && (
                          <span className="text-green-600">
                            Completada {formatDateTime(activity.completed_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {!activity.completed_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleComplete(activity.id)}
                        title="Marcar como completada"
                        data-testid={`complete-activity-${activity.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {activity.description}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDateTime(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
