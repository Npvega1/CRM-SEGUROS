'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Palette, Users, Building2, Save, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { tenantId, tenantName, tenantSlug } = useTenant();
  const [activeTab, setActiveTab] = useState('account');
  const { toast } = useToast();
  const supabase = createClient();

  const [primaryColor, setPrimaryColor] = useState('#1E3A5F');
  const [secondaryColor, setSecondaryColor] = useState('#2E86AB');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
          setPrimaryColor(data.primary_color || '#1E3A5F');
          setSecondaryColor(data.secondary_color || '#2E86AB');
        }
      } catch (error) {
        console.log('No settings found, using defaults');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [tenantId, supabase]);

  const handleSave = async () => {
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
                          placeholder="#1E3A5F"
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
                          placeholder="#2E86AB"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Vista Previa</Label>
                    <div className="border rounded-lg p-4 space-y-3">
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

                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestión de Equipo
              </CardTitle>
              <CardDescription>Administra los agentes de tu organización</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Próximamente: Invitar y gestionar agentes.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
