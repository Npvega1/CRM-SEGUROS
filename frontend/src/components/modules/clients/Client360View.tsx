'use client';

// =====================================================
// COMPONENTE: Client360View
// Vista 360° del cliente con tabs
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  type Client, 
  SEGMENT_LABELS, 
  SEGMENT_COLORS,
  DOC_TYPE_LABELS,
  type ClientSegment,
  type DocType
} from '@/lib/validations/clients';
import {
  type Policy,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatPremium,
  formatDate,
  type PolicyStatus,
  type PolicyLine
} from '@/lib/validations/policies';
import {
  User,
  Mail,
  Phone,
  FileText,
  AlertTriangle,
  CreditCard,
  BarChart3,
  Plus,
  Edit,
  Calendar,
  Building
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';

interface Client360ViewProps {
  client: Client;
}

export function Client360View({ client }: Client360ViewProps) {
  const { tenantId } = useTenant();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(true);

  const loadPolicies = useCallback(async () => {
    if (!tenantId || !client.id) return;
    
    setIsLoadingPolicies(true);
    try {
      const supabase = getBrowserClient();
      
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading policies:', error);
      } else {
        setPolicies((data || []) as Policy[]);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
    }
    setIsLoadingPolicies(false);
  }, [tenantId, client.id]);

  useEffect(() => {
    if (tenantId && client.id) {
      loadPolicies();
    }
  }, [tenantId, client.id, loadPolicies]);

  const activePolicies = policies.filter(p => p.status === 'activa');
  const totalPremium = activePolicies.reduce((sum, p) => sum + Number(p.premium), 0);

  return (
    <div className="space-y-6">
      {/* Header del Cliente */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{client.full_name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={SEGMENT_COLORS[client.segment as ClientSegment]}>
                    {SEGMENT_LABELS[client.segment as ClientSegment]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {DOC_TYPE_LABELS[client.doc_type as DocType]}: {client.doc_number}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  {client.email && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {client.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/clientes/${client.id}/editar`}>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </Link>
              <Link href={`/polizas/nueva?clientId=${client.id}`}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Póliza
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{policies.length}</p>
              <p className="text-sm text-muted-foreground">Total Pólizas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{activePolicies.length}</p>
              <p className="text-sm text-muted-foreground">Activas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatPremium(totalPremium)}</p>
              <p className="text-sm text-muted-foreground">Prima Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Siniestros</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de contenido */}
      <Tabs defaultValue="polizas" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="polizas" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Pólizas</span>
          </TabsTrigger>
          <TabsTrigger value="siniestros" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Siniestros</span>
          </TabsTrigger>
          <TabsTrigger value="cuotas" className="gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Cuotas</span>
          </TabsTrigger>
          <TabsTrigger value="comparativos" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Comparativos</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Pólizas */}
        <TabsContent value="polizas">
          <Card>
            <CardHeader>
              <CardTitle>Pólizas del Cliente</CardTitle>
              <CardDescription>
                Historial completo de pólizas asociadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPolicies ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Cargando pólizas...</p>
                </div>
              ) : policies.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay pólizas registradas</p>
                  <Link href={`/polizas/nueva?clientId=${client.id}`}>
                    <Button variant="outline" className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Primera Póliza
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <Link key={policy.id} href={`/polizas/${policy.id}`}>
                      <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">#{policy.policy_number}</span>
                              <Badge className={POLICY_STATUS_COLORS[policy.status as PolicyStatus]}>
                                {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {policy.insurer}
                              </span>
                              <span>{POLICY_LINE_LABELS[policy.line as PolicyLine]}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatPremium(Number(policy.premium), policy.currency)}</p>
                            {policy.end_date && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                                <Calendar className="w-3 h-3" />
                                Vence: {formatDate(policy.end_date)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Siniestros (ahora con link a M03) */}
        <TabsContent value="siniestros">
          <Card>
            <CardHeader>
              <CardTitle>Siniestros</CardTitle>
              <CardDescription>
                Historial de siniestros reportados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Ver siniestros del cliente</p>
                <Link href={`/siniestros?clientId=${client.id}`}>
                  <Button variant="outline" className="mt-4">
                    Ver Siniestros
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Cuotas (Stub M05) */}
        <TabsContent value="cuotas">
          <Card>
            <CardHeader>
              <CardTitle>Cuotas y Pagos</CardTitle>
              <CardDescription>
                Estado de cuotas y pagos pendientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Módulo de Facturación (M05)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta funcionalidad estará disponible próximamente
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Comparativos (Stub M09) */}
        <TabsContent value="comparativos">
          <Card>
            <CardHeader>
              <CardTitle>Comparativos con IA</CardTitle>
              <CardDescription>
                Análisis y comparativas de pólizas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Módulo de Comparativos IA (M09)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta funcionalidad estará disponible próximamente
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
