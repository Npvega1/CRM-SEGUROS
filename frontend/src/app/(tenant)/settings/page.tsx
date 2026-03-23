'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings, Palette, Users, Building2, Save, Loader2, UserPlus, Mail, Clock, X, Shield, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

interface UserPermission {
  section: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_download: boolean;
}

const SECTIONS = [
  { id: 'clientes', label: 'Clientes', hasCreate: true, hasEdit: true, hasDownload: true },
  { id: 'polizas', label: 'Pólizas', hasCreate: true, hasEdit: true, hasDownload: true },
  { id: 'pipeline', label: 'Pipeline', hasCreate: true, hasEdit: true, hasDownload: true },
  { id: 'siniestros', label: 'Siniestros', hasCreate: true, hasEdit: true, hasDownload: true },
  { id: 'facturacion', label: 'Facturación', hasCreate: true, hasEdit: true, hasDownload: true },
  { id: 'reportes', label: 'Reportes', hasCreate: false, hasEdit: false, hasDownload: true },
  { id: 'mensajes', label: 'Mensajes', hasCreate: true, hasEdit: false, hasDownload: false },
  { id: 'automatizaciones', label: 'Automatizaciones', hasCreate: true, hasEdit: true, hasDownload: false },
];

export default function SettingsPage() {
  const { tenantId, tenantName, tenantSlug, userId, role: currentUserRole } = useTenant();
  const [activeTab, setActiveTab] = useState('account');
  const { toast } = useToast();
  const supabase = createClient();

  // Branding
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#1e40af');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Equipo
  const [agents, setAgents] = useState<Agent[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Permisos
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  // Cargar branding
  useEffect(() => {
    async function loadSettings() {
      if (!tenantId) return;
      try {
        const { data } = await (supabase.from('tenant_settings') as any)
          .select('*').eq('tenant_id', tenantId).single();
        if (data) {
          setPrimaryColor(data.primary_color || '#3b82f6');
          setSecondaryColor(data.secondary_color || '#1e40af');
        }
      } catch (error) {
        console.log('No settings found');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [tenantId, supabase]);

  // Cargar agentes e invitaciones
  useEffect(() => {
    async function loadTeam() {
      if (!tenantId) return;
      try {
        const { data: agentsData } = await (supabase.from('users') as any)
          .select('id, email, full_name, role, is_active, created_at')
          .eq('tenant_id', tenantId).order('created_at', { ascending: true });
        if (agentsData) setAgents(agentsData);

        const { data: invData } = await (supabase.from('invitations') as any)
          .select('id, email, role, created_at, expires_at')
          .eq('tenant_id', tenantId).is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });
        if (invData) setInvitations(invData);
      } catch (error) {
        console.log('Error loading team:', error);
      } finally {
        setLoadingAgents(false);
      }
    }
    loadTeam();
  }, [tenantId, supabase]);

  // Cargar permisos de un agente
  const loadAgentPermissions = async (agent: Agent) => {
    setSelectedAgent(agent);
    setLoadingPermissions(true);
    setPermissionsDialogOpen(true);

    try {
      const { data } = await (supabase.from('user_permissions') as any)
        .select('section, can_view, can_create, can_edit, can_download')
        .eq('user_id', agent.id);

      // Crear permisos para todas las secciones
      const allPermissions: UserPermission[] = SECTIONS.map(section => {
        const existing = data?.find((p: UserPermission) => p.section === section.id);
        return {
          section: section.id,
          can_view: existing?.can_view || false,
          can_create: existing?.can_create || false,
          can_edit: existing?.can_edit || false,
          can_download: existing?.can_download || false,
        };
      });

      setPermissions(allPermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los permisos', variant: 'destructive' });
    } finally {
      setLoadingPermissions(false);
    }
  };

  // Actualizar permiso localmente
  const updatePermission = (section: string, field: keyof UserPermission, value: boolean) => {
    setPermissions(prev => prev.map(p => {
      if (p.section === section) {
        // Si desactivan "Ver", desactivar todo lo demás
        if (field === 'can_view' && !value) {
          return { ...p, can_view: false, can_create: false, can_edit: false, can_download: false };
        }
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  // Guardar permisos
  const savePermissions = async () => {
    if (!selectedAgent || !tenantId) return;
    setSavingPermissions(true);

    try {
      // Eliminar permisos existentes
      await (supabase.from('user_permissions') as any)
        .delete()
        .eq('user_id', selectedAgent.id);

      // Insertar nuevos permisos
      const permissionsToInsert = permissions.map(p => ({
        user_id: selectedAgent.id,
        tenant_id: tenantId,
        section: p.section,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_download: p.can_download,
      }));

      const { error } = await (supabase.from('user_permissions') as any)
        .insert(permissionsToInsert);

      if (error) throw error;

      toast({ title: 'Permisos guardados', description: `Los permisos de ${selectedAgent.full_name || selectedAgent.email} han sido actualizados` });
      setPermissionsDialogOpen(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({ title: 'Error', description: 'No se pudieron guardar los permisos', variant: 'destructive' });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from('tenant_settings') as any)
        .upsert({ tenant_id: tenantId, primary_color: primaryColor, secondary_color: secondaryColor, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
      if (error) throw error;
      toast({ title: 'Configuración guardada', description: 'Los colores se han actualizado. Recargando...' });
      // Recargar la página después de 1 segundo para aplicar los nuevos colores
      setTimeout(() => { window.location.reload(); }, 1000);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleInviteAgent = async () => {
    if (!inviteEmail || !tenantId || !userId) return;
    setInviting(true);
    try {
      const { data: existing } = await (supabase.from('users') as any)
        .select('id').eq('tenant_id', tenantId).eq('email', inviteEmail.toLowerCase()).single();
      if (existing) {
        toast({ title: 'Error', description: 'Este email ya está registrado', variant: 'destructive' });
        setInviting(false);
        return;
      }

      const { data: pendingInv } = await (supabase.from('invitations') as any)
        .select('id').eq('tenant_id', tenantId).eq('email', inviteEmail.toLowerCase())
        .is('accepted_at', null).gt('expires_at', new Date().toISOString()).single();
      if (pendingInv) {
        toast({ title: 'Error', description: 'Ya existe una invitación pendiente para este email', variant: 'destructive' });
        setInviting(false);
        return;
      }

      // Siempre crear como "agent" - los permisos se configuran después
      const { data: newInv, error } = await (supabase.from('invitations') as any)
        .insert({
          tenant_id: tenantId,
          email: inviteEmail.toLowerCase(),
          role: 'agent',
          invited_by: userId,
        }).select().single();

      if (error) throw error;

      setInvitations([newInv, ...invitations]);
      toast({ title: 'Invitación creada', description: `Se ha creado la invitación para ${inviteEmail}. Configura los permisos cuando el agente acepte.` });
      setInviteEmail('');
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'No se pudo crear la invitación', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (invId: string) => {
    try {
      await (supabase.from('invitations') as any).delete().eq('id', invId);
      setInvitations(invitations.filter(i => i.id !== invId));
      toast({ title: 'Invitación cancelada' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cancelar', variant: 'destructive' });
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      agent: 'bg-green-100 text-green-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      agent: 'Agente',
    };
    return labels[role] || role;
  };

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">Administra tu organización</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="account" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-3">
            <Building2 className="h-4 w-4" /><span className="hidden sm:inline">Cuenta</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-3">
            <Palette className="h-4 w-4" /><span className="hidden sm:inline">Visual</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-3">
            <Users className="h-4 w-4" /><span className="hidden sm:inline">Equipo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Información de la Cuenta</CardTitle>
              <CardDescription>Datos de tu organización</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1"><label className="text-sm font-medium text-muted-foreground">Nombre</label><p className="font-medium">{tenantName}</p></div>
                <div className="space-y-1"><label className="text-sm font-medium text-muted-foreground">Slug</label><p className="font-mono text-sm">{tenantSlug}</p></div>
                <div className="space-y-1"><label className="text-sm font-medium text-muted-foreground">ID</label><p className="font-mono text-xs text-muted-foreground">{tenantId}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Personalización Visual</CardTitle>
              <CardDescription>Personaliza los colores de tu CRM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Color Primario</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                        <Input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Color Secundario</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                        <Input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Vista Previa</Label>
                    <div className="border rounded-lg p-4 flex gap-2">
                      <div className="w-24 h-10 rounded flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>Primario</div>
                      <div className="w-24 h-10 rounded flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: secondaryColor }}>Secundario</div>
                    </div>
                  </div>
                  <Button onClick={handleSaveBranding} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Invitar Agente</CardTitle>
                <CardDescription>Envía una invitación para unirse a tu equipo. Podrás configurar sus permisos después.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input type="email" placeholder="correo@ejemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
                  <Button onClick={handleInviteAgent} disabled={inviting || !inviteEmail}>
                    {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Invitar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">El nuevo agente se creará sin permisos. Configúralos desde la lista de miembros.</p>
              </CardContent>
            </Card>
          )}

          {invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Invitaciones Pendientes ({invitations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
                      <div>
                        <p className="font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">Expira: {new Date(inv.expires_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadge('agent')}>Agente</Badge>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleCancelInvitation(inv.id)}><X className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Miembros del Equipo ({agents.length})</CardTitle>
              <CardDescription>
                {isAdmin ? 'Haz clic en un agente para configurar sus permisos' : 'Agentes activos en tu organización'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : agents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay agentes registrados</p>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div 
                      key={agent.id} 
                      className={`flex items-center justify-between p-4 border rounded-lg ${isAdmin && agent.role !== 'admin' ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                      onClick={() => isAdmin && agent.role !== 'admin' && loadAgentPermissions(agent)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">{agent.full_name?.charAt(0) || agent.email.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium">{agent.full_name || 'Sin nombre'}</p>
                          <p className="text-sm text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadge(agent.role)}>{getRoleLabel(agent.role)}</Badge>
                        {!agent.is_active && <Badge variant="outline" className="text-red-600">Inactivo</Badge>}
                        {isAdmin && agent.role !== 'admin' && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Permisos */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permisos de {selectedAgent?.full_name || selectedAgent?.email}
            </DialogTitle>
            <DialogDescription>
              Configura qué puede hacer este agente en cada sección del sistema
            </DialogDescription>
          </DialogHeader>

          {loadingPermissions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Encabezado de la tabla */}
              <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <div>Sección</div>
                <div className="text-center">Ver</div>
                <div className="text-center">Crear</div>
                <div className="text-center">Editar</div>
                <div className="text-center">Descargar</div>
              </div>

              {/* Filas de permisos */}
              {SECTIONS.map((section) => {
                const perm = permissions.find(p => p.section === section.id);
                return (
                  <div key={section.id} className="grid grid-cols-5 gap-2 items-center py-2 border-b">
                    <div className="font-medium text-sm">{section.label}</div>
                    <div className="flex justify-center">
                      <Switch
                        checked={perm?.can_view || false}
                        onCheckedChange={(checked) => updatePermission(section.id, 'can_view', checked)}
                      />
                    </div>
                    <div className="flex justify-center">
                      {section.hasCreate ? (
                        <Switch
                          checked={perm?.can_create || false}
                          onCheckedChange={(checked) => updatePermission(section.id, 'can_create', checked)}
                          disabled={!perm?.can_view}
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      {section.hasEdit ? (
                        <Switch
                          checked={perm?.can_edit || false}
                          onCheckedChange={(checked) => updatePermission(section.id, 'can_edit', checked)}
                          disabled={!perm?.can_view}
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      {section.hasDownload ? (
                        <Switch
                          checked={perm?.can_download || false}
                          onCheckedChange={(checked) => updatePermission(section.id, 'can_download', checked)}
                          disabled={!perm?.can_view}
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={savePermissions} disabled={savingPermissions}>
                  {savingPermissions ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Guardar Permisos</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
