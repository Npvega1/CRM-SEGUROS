'use client';

// =====================================================
// PÁGINA: Automatizaciones
// Lista de automatizaciones con toggle on/off
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingScreen } from '@/components/ui/spinner';
import { AutomationBuilder } from '@/components/modules/automations/AutomationBuilder';
import { EmailTemplateEditor } from '@/components/modules/automations/EmailTemplateEditor';
import { AutomationLogs } from '@/components/modules/automations/AutomationLogs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Zap,
  Mail,
  History,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  Play
} from 'lucide-react';
import {
  type AutomationWithStats,
  type EmailTemplate,
  TRIGGER_EVENT_LABELS,
  formatDateTime
} from '@/lib/validations/automations';

export default function AutomationsPage() {
  const { tenantId, role, isLoading: tenantLoading } = useTenant();
  const [activeTab, setActiveTab] = useState('automations');
  const [automations, setAutomations] = useState<AutomationWithStats[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationWithStats | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [selectedAutomationForLogs, setSelectedAutomationForLogs] = useState<AutomationWithStats | null>(null);

  const supabase = getBrowserClient();

  // Cargar automatizaciones
  const loadAutomations = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      // Usar consulta directa en lugar de RPC
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: autoData, error: autoError } = await (supabase as any)
        .from('automations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (autoError) throw autoError;
      
      // Obtener estadísticas para cada automatización
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const automationsWithStats: AutomationWithStats[] = await Promise.all(
        (autoData || []).map(async (automation: Record<string, unknown>) => {
          // Contar acciones
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { count: actionsCount } = await (supabase as any)
            .from('automation_actions')
            .select('*', { count: 'exact', head: true })
            .eq('automation_id', automation.id);

          // Obtener último log
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: lastLog } = await (supabase as any)
            .from('automation_logs_v2')
            .select('executed_at, status')
            .eq('automation_id', automation.id)
            .order('executed_at', { ascending: false })
            .limit(1)
            .single();

          // Contar logs por status
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: logStats } = await (supabase as any)
            .from('automation_logs_v2')
            .select('status')
            .eq('automation_id', automation.id);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const successCount = logStats?.filter((l: Record<string, unknown>) => l.status === 'success').length || 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errorCount = logStats?.filter((l: Record<string, unknown>) => l.status === 'error').length || 0;

          return {
            ...automation,
            conditions: automation.conditions as AutomationWithStats['conditions'],
            actions_count: actionsCount || 0,
            last_execution_at: lastLog?.executed_at || null,
            last_execution_status: lastLog?.status as AutomationWithStats['last_execution_status'] || null,
            total_executions: (successCount + errorCount),
            successful_executions: successCount,
            failed_executions: errorCount
          } as AutomationWithStats;
        })
      );

      setAutomations(automationsWithStats);
    } catch (err) {
      console.error('Error loading automations:', err);
      setError('Error al cargar automatizaciones');
    }
  }, [tenantId, supabase]);

  // Cargar plantillas de email
  const loadTemplates = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('email_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTemplates((data || []) as EmailTemplate[]);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  }, [tenantId, supabase]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadAutomations(), loadTemplates()]);
      setIsLoading(false);
    };

    if (tenantId) {
      loadData();
    }
  }, [tenantId, loadAutomations, loadTemplates]);

  // Toggle activación de automatización
  const handleToggleAutomation = async (automation: AutomationWithStats) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('automations')
        .update({ is_active: !automation.is_active })
        .eq('id', automation.id);

      if (updateError) throw updateError;
      
      setAutomations(prev => 
        prev.map(a => 
          a.id === automation.id 
            ? { ...a, is_active: !a.is_active } 
            : a
        )
      );
    } catch (err) {
      console.error('Error toggling automation:', err);
      setError('Error al cambiar estado');
    }
  };

  // Eliminar automatización
  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta automatización?')) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('automations')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting automation:', err);
      setError('Error al eliminar');
    }
  };

  // Eliminar plantilla
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting template:', err);
      setError('Error al eliminar');
    }
  };

  // Callbacks para modales
  const handleAutomationSaved = () => {
    setShowAutomationBuilder(false);
    setEditingAutomation(null);
    loadAutomations();
  };

  const handleTemplateSaved = () => {
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    loadTemplates();
  };

  const handleEditAutomation = (automation: AutomationWithStats) => {
    setEditingAutomation(automation);
    setShowAutomationBuilder(true);
  };

  const handleViewLogs = (automation: AutomationWithStats) => {
    setSelectedAutomationForLogs(automation);
    setShowLogs(true);
  };

  const canEdit = role === 'admin' || role === 'senior_agent';

  if (tenantLoading || isLoading) {
    return <LoadingScreen message="Cargando automatizaciones..." />;
  }

  return (
    <div className="p-6 space-y-6" data-testid="automations-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Automatizaciones
          </h1>
          <p className="text-muted-foreground mt-1">
            Configura workflows automáticos para tu agencia
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="automations" className="gap-2">
              <Zap className="h-4 w-4" />
              Automatizaciones
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Mail className="h-4 w-4" />
              Plantillas de Email
            </TabsTrigger>
          </TabsList>

          {canEdit && (
            <div className="flex gap-2">
              {activeTab === 'automations' ? (
                <Button 
                  onClick={() => {
                    setEditingAutomation(null);
                    setShowAutomationBuilder(true);
                  }}
                  data-testid="new-automation-btn"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Automatización
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    setEditingTemplate(null);
                    setShowTemplateEditor(true);
                  }}
                  data-testid="new-template-btn"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Plantilla
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tab: Automatizaciones */}
        <TabsContent value="automations" className="mt-6">
          {automations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay automatizaciones</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crea tu primera automatización para optimizar tus procesos
                </p>
                {canEdit && (
                  <Button onClick={() => setShowAutomationBuilder(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Automatización
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {automations.map((automation) => (
                <Card 
                  key={automation.id} 
                  className={!automation.is_active ? 'opacity-60' : ''}
                  data-testid={`automation-card-${automation.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold truncate">{automation.name}</h3>
                          <Badge variant={automation.is_active ? 'success' : 'secondary'}>
                            {automation.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {automation.description || 'Sin descripción'}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Trigger:</span>
                            <Badge variant="outline">
                              {TRIGGER_EVENT_LABELS[automation.trigger_event]}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Play className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Acciones:</span>
                            <span>{automation.actions_count}</span>
                          </div>

                          {automation.last_execution_at && (
                            <div className="flex items-center gap-1.5">
                              {automation.last_execution_status === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="text-muted-foreground">Última ejecución:</span>
                              <span className={automation.last_execution_status === 'success' 
                                ? 'text-green-600' 
                                : 'text-red-600'
                              }>
                                {formatDateTime(automation.last_execution_at)}
                              </span>
                            </div>
                          )}

                          {automation.total_executions > 0 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <span>{automation.successful_executions}/{automation.total_executions} éxitos</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <Switch
                            checked={automation.is_active}
                            onCheckedChange={() => handleToggleAutomation(automation)}
                            data-testid={`toggle-automation-${automation.id}`}
                          />
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewLogs(automation)}>
                              <History className="h-4 w-4 mr-2" />
                              Ver historial
                            </DropdownMenuItem>
                            {canEdit && (
                              <>
                                <DropdownMenuItem onClick={() => handleEditAutomation(automation)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteAutomation(automation.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Plantillas de Email */}
        <TabsContent value="templates" className="mt-6">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay plantillas</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crea plantillas de email para usar en tus automatizaciones
                </p>
                {canEdit && (
                  <Button onClick={() => setShowTemplateEditor(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Plantilla
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card 
                  key={template.id}
                  className={!template.is_active ? 'opacity-60' : ''}
                  data-testid={`template-card-${template.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base truncate">{template.name}</CardTitle>
                      <Badge variant={template.is_active ? 'success' : 'secondary'}>
                        {template.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2 truncate">
                      <span className="font-medium">Asunto:</span> {template.subject}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Creada: {formatDateTime(template.created_at)}
                    </p>
                    
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateEditor(true);
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal: Automation Builder */}
      <Dialog open={showAutomationBuilder} onOpenChange={setShowAutomationBuilder}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? 'Editar Automatización' : 'Nueva Automatización'}
            </DialogTitle>
          </DialogHeader>
          <AutomationBuilder
            automation={editingAutomation}
            templates={templates}
            onSave={handleAutomationSaved}
            onCancel={() => {
              setShowAutomationBuilder(false);
              setEditingAutomation(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal: Email Template Editor */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de Email'}
            </DialogTitle>
          </DialogHeader>
          <EmailTemplateEditor
            template={editingTemplate}
            onSave={handleTemplateSaved}
            onCancel={() => {
              setShowTemplateEditor(false);
              setEditingTemplate(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal: Automation Logs */}
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Historial de Ejecuciones: {selectedAutomationForLogs?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedAutomationForLogs && (
            <AutomationLogs automationId={selectedAutomationForLogs.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
