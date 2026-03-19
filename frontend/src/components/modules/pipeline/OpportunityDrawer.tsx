'use client';

// =====================================================
// COMPONENTE: OpportunityDrawer
// Panel lateral con detalle de oportunidad
// =====================================================

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Calendar, 
  DollarSign, 
  Percent,
  Phone,
  Mail,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { ActivityTimeline } from './ActivityTimeline';
import type { 
  OpportunityWithRelations, 
  PipelineStage, 
  Activity,
  CreateActivityInput
} from '@/lib/validations/pipeline';
import { 
  formatPremium, 
  formatDate,
  getProbabilityColor,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_STATUS_COLORS
} from '@/lib/validations/pipeline';
import { POLICY_LINE_LABELS } from '@/lib/validations/policies';

interface OpportunityDrawerProps {
  open: boolean;
  opportunity: OpportunityWithRelations | null;
  stages: PipelineStage[];
  activities: Activity[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<OpportunityWithRelations>) => Promise<void>;
  onCreateActivity: (data: CreateActivityInput) => Promise<void>;
  onCompleteActivity: (activityId: string) => Promise<void>;
}

export function OpportunityDrawer({
  open,
  opportunity,
  stages,
  activities,
  onClose,
  onUpdate,
  onCreateActivity,
  onCompleteActivity
}: OpportunityDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    estimated_premium: 0,
    close_probability: 50,
    expected_close_date: '',
    notes: '',
    stage_id: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (opportunity) {
      setEditData({
        estimated_premium: opportunity.estimated_premium,
        close_probability: opportunity.close_probability,
        expected_close_date: opportunity.expected_close_date || '',
        notes: opportunity.notes || '',
        stage_id: opportunity.stage_id
      });
    }
  }, [opportunity]);

  const handleSave = async () => {
    if (!opportunity) return;
    
    setIsSaving(true);
    try {
      await onUpdate(opportunity.id, editData);
      setIsEditing(false);
    } catch (e) {
      console.error('Error saving:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (opportunity) {
      setEditData({
        estimated_premium: opportunity.estimated_premium,
        close_probability: opportunity.close_probability,
        expected_close_date: opportunity.expected_close_date || '',
        notes: opportunity.notes || '',
        stage_id: opportunity.stage_id
      });
    }
    setIsEditing(false);
  };

  if (!opportunity) return null;

  const lineLabel = POLICY_LINE_LABELS[opportunity.line];
  const currentStage = stages.find(s => s.id === opportunity.stage_id);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="opportunity-drawer"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {opportunity.client?.full_name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={OPPORTUNITY_STATUS_COLORS[opportunity.status]}>
                {OPPORTUNITY_STATUS_LABELS[opportunity.status]}
              </Badge>
              {opportunity.status === 'active' && !isEditing && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  data-testid="edit-opportunity-btn"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="activities">
              Actividades ({activities.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Información del cliente */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">
                Información del Cliente
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{opportunity.client?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {opportunity.client?.segment}
                    </p>
                  </div>
                </div>
                {opportunity.client?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`mailto:${opportunity.client.email}`}
                      className="text-sm hover:underline"
                    >
                      {opportunity.client.email}
                    </a>
                  </div>
                )}
                {opportunity.client?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`tel:${opportunity.client.phone}`}
                      className="text-sm hover:underline"
                    >
                      {opportunity.client.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Detalles de la oportunidad */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">
                Detalles de la Oportunidad
              </h4>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-stage">Etapa</Label>
                      <Select
                        value={editData.stage_id}
                        onValueChange={(value) => setEditData(prev => ({ ...prev, stage_id: value }))}
                      >
                        <SelectTrigger id="edit-stage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.filter(s => 
                            !s.name.toLowerCase().includes('ganado') && 
                            !s.name.toLowerCase().includes('perdido')
                          ).map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                {stage.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-premium">Prima Estimada</Label>
                      <Input
                        id="edit-premium"
                        type="number"
                        value={editData.estimated_premium}
                        onChange={(e) => setEditData(prev => ({ 
                          ...prev, 
                          estimated_premium: parseFloat(e.target.value) || 0 
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-probability">Probabilidad (%)</Label>
                      <Input
                        id="edit-probability"
                        type="number"
                        min="0"
                        max="100"
                        value={editData.close_probability}
                        onChange={(e) => setEditData(prev => ({ 
                          ...prev, 
                          close_probability: parseInt(e.target.value) || 0 
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-date">Fecha Esperada de Cierre</Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={editData.expected_close_date}
                        onChange={(e) => setEditData(prev => ({ 
                          ...prev, 
                          expected_close_date: e.target.value 
                        }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notas</Label>
                    <Textarea
                      id="edit-notes"
                      value={editData.notes}
                      onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-1" />
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Etapa</p>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: currentStage?.color }}
                      />
                      <span className="font-medium">{currentStage?.name}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ramo</p>
                    <Badge variant="secondary">{lineLabel}</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Prima Estimada
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      {formatPremium(opportunity.estimated_premium)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      Probabilidad
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{opportunity.close_probability}%</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className={`h-full ${getProbabilityColor(opportunity.close_probability)}`}
                          style={{ width: `${opportunity.close_probability}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Fecha Esperada
                    </p>
                    <p className="font-medium">{formatDate(opportunity.expected_close_date)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Prima Ponderada</p>
                    <p className="font-medium text-muted-foreground">
                      {formatPremium(opportunity.estimated_premium * opportunity.close_probability / 100)}
                    </p>
                  </div>

                  {opportunity.notes && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-xs text-muted-foreground">Notas</p>
                      <p className="text-sm bg-muted/50 p-2 rounded">
                        {opportunity.notes}
                      </p>
                    </div>
                  )}

                  {opportunity.status === 'lost' && opportunity.lost_reason && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-xs text-destructive">Razón de Pérdida</p>
                      <p className="text-sm bg-destructive/10 text-destructive p-2 rounded">
                        {opportunity.lost_reason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Agente asignado */}
            {opportunity.agent && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                {opportunity.agent.avatar_url ? (
                  <img
                    src={opportunity.agent.avatar_url}
                    alt={opportunity.agent.full_name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{opportunity.agent.full_name}</p>
                  <p className="text-xs text-muted-foreground">Agente asignado</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activities" className="mt-4">
            <ActivityTimeline
              activities={activities}
              opportunityId={opportunity.id}
              clientId={opportunity.client_id}
              onCreateActivity={onCreateActivity}
              onCompleteActivity={onCompleteActivity}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
