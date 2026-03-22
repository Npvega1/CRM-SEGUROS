'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Palette, Users, Building2, Save, Loader2, UserPlus, Mail, Clock, X } from 'lucide-react';
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

export default function SettingsPage() {
  const { tenantId, tenantName, tenantSlug, userId } = useTenant();
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
  const [inviteRole, setInviteRole] = useState('agent');
  const [inviting, setInviting] = useState(false);

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

  const handleSaveBranding = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from('tenant_settings') as any)
        .upsert({ tenant_id: tenantId, primary_color: primaryColor, secondary_color: secondaryColor, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
      if (error) throw error;
      toast({ title: 'Configuración guardada', description: 'Los colores se han actualizado' });
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
      // Verificar si ya existe
      const { data: existing } = await (supabase.from('users') as any)
        .select('id').eq('tenant_id', tenantId).eq('email', inviteEmail.toLowerCase()).single();
      if (existing) {
        toast({ title: 'Error', description: 'Este email ya está registrado', variant: 'destructive' });
        setInviting(false);
        return;
      }

      // Verificar invitación pendiente
      const { data: pendingInv } = await (supabase.from('invitations') as any)
        .select('id').eq('tenant_id', tenantId).eq('email', inviteEmail.toLowerCase())
        .is('accepted_at', null).gt('expires_at', new Date().toISOString()).single();
      if (pendingInv) {
        toast({ title: 'Error', description: 'Ya existe una invitación pendiente para este email', variant: 'destructive' });
        setInviting(false);
        return;
      }

      // Crear invitación
      const { data: newInv, error } = await (supabase.from('invitations') as any)
        .insert({
          tenant_id: tenantId,
          email: inviteEmail.toLowerCase(),
          role: inviteRole,
          invited_by: userId,
        }).select().single();

      if (error) throw error;

      setInvitations([newInv, ...invitations]);
      toast({ title: 'Invitación creada', description: `Se ha creado la invitación para ${inviteEmail} (Email MOCK - no se envía realmente)` });
      setInviteEmail('');
      setInviteRole('agent');
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
      admin: 'bg-red-100 text-red-800', superadmin: 'bg-purple-100 text-purple-800',
      senior_agent: 'bg-blue-100 text-blue-800', agent: 'bg-green-100 text-green-800', readonly: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador', superadmin: 'Super Admin', senior_agent: 'Agente Senior', agent: 'Agente', readonly: 'Solo Lectura',
    };
    return labels[role] || role;
  };

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Invitar Agente</CardTitle>
              <CardDescription>Envía una invitación para unirse a tu equipo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input type="email" placeholder="correo@ejemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agente</SelectItem>
                    <SelectItem value="senior_agent">Agente Senior</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="readonly">Solo Lectura</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInviteAgent} disabled={inviting || !inviteEmail}>
                  {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Invitar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">La invitación se guardará en la base de datos. El email es MOCK (no se envía realmente).</p>
            </CardContent>
          </Card>

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
                        <Badge className={getRoleBadge(inv.role)}>{getRoleLabel(inv.role)}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleCancelInvitation(inv.id)}><X className="h-4 w-4" /></Button>
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
              <CardDescription>Agentes activos en tu organización</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : agents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay agentes registrados</p>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
