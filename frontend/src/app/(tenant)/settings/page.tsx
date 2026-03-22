'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Palette, Users, Building2, Save, Loader2, UserPlus, Mail } from 'lucide-react';
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

export default function SettingsPage() {
  const { tenantId, tenantName, tenantSlug } = useTenant();
  const [activeTab, setActiveTab] = useState('account');
  const { toast } = useToast();
  const supabase = createClient();

  // Estado para branding
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#1e40af');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estado para equipo
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Cargar configuración de branding
  useEffect(() => {
    async function loadSettings() {
      if (!tenantId) return;
      try {
        const { data } = await (supabase
          .from('tenant_settings') as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .single();
        
        if (data) {
          setPrimaryColor(data.primary_color || '#3b82f6');
          setSecondaryColor(data.secondary_color || '#1e40af');
        }
      } catch (error) {
        console.log('No settings found, using defaults');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [tenantId, supabase]);

  // Cargar agentes
  useEffect(() => {
    async function loadAgents() {
      if (!tenantId) return;
      try {
        const { data } = await (supabase
          .from('users') as any)
          .select('id, email, full_name, role, is_active, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true });
        
        if (data) {
          setAgents(data);
        }
      } catch (error) {
        console.log('Error loading agents:', error);
      } finally {
        setLoadingAgents(false);
      }
    }
    loadAgents();
  }, [tenantId, supabase]);

  // Guardar branding
  const handleSaveBranding = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await (supabase
        .from('tenant_settings') as any)
        .upsert({
          tenant_id: tenantId,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

      if (error) throw error;

      toast({
        title: 'Configuración guardada',
        description: 'Los colores se han actualizado correctamente',
      });
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Invitar agente (MOCK)
  const handleInviteAgent = async () => {
    if (!inviteEmail || !tenantId) return;
    setInviting(true);
    
    // Simulación de invitación
    setTimeout(() => {
      toast({
        title: 'Invitación enviada',
        description: `Se ha enviado una invitación a ${inviteEmail} (MOCK)`,
      });
      setInviteEmail('');
      setInviting(false);
    }, 1000);
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      superadmin: 'bg-purple-100 text-purple-800',
      senior_agent: 'bg-blue-100 text-blue-800',
      agent: 'bg-green-100 text-green-800',
      readonly: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      superadmin: 'Super Admin',
      senior_agent: 'Agente Senior',
      agent: 'Agente',
      readonly: 'Solo Lectura',
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
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Cuenta</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-3">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Visual</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-3">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Equipo</span>
          </TabsTrigger>
        </TabsList>

        {/* Pestaña Cuenta */}
        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Información de la Cuenta
              </CardTitle>
              <CardDescription>Datos de tu organización</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                  <p className="font-medium">{tenantName}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Slug</label>
                  <p className="font-mono text-sm">{tenantSlug}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">ID</label>
                  <p className="font-mono text-xs text-muted-foreground">{tenantId}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Branding */}
        <TabsContent value="branding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personalización Visual
              </CardTitle>
              <CardDescription>Personaliza los colores de tu CRM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Color Primario</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-16 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondaryColor">Color Secundario</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-16 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Vista Previa</Label>
                    <div className="border rounded-lg p-4">
                      <div className="flex gap-2">
                        <div
                          className="w-24 h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Primario
                        </div>
                        <div
                          className="w-24 h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: secondaryColor }}
                        >
                          Secundario
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveBranding} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Equipo */}
        <TabsContent value="team" className="mt-6 space-y-6">
          {/* Invitar agente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Invitar Agente
              </CardTitle>
              <CardDescription>Envía una invitación por email para unirse a tu equipo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <Button onClick={handleInviteAgent} disabled={inviting || !inviteEmail}>
                  {inviting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  {inviting ? 'Enviando...' : 'Invitar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                El agente recibirá un email con instrucciones para unirse (MOCK).
              </p>
            </CardContent>
          </Card>

          {/* Lista de agentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Miembros del Equipo ({agents.length})
              </CardTitle>
              <CardDescription>Gestiona los agentes de tu organización</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : agents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay agentes registrados</p>
              ) : (
                <div className="space-y-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {agent.full_name?.charAt(0) || agent.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{agent.full_name || 'Sin nombre'}</p>
                          <p className="text-sm text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadge(agent.role)}>
                          {getRoleLabel(agent.role)}
                        </Badge>
                        {!agent.is_active && (
                          <Badge variant="outline" className="text-red-600">
                            Inactivo
                          </Badge>
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
    </div>
  );
}
