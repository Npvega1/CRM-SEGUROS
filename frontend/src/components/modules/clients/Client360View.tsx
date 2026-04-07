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
  Plus,
  Edit,
  Calendar,
  Building,
  FolderOpen,
  Clock,
  Download,
  Layers
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';

// Tipo extendido para póliza con nombre de grupo
interface PolicyWithGroup extends Policy {
  insurance_groups?: { name: string } | null;
}

// Tipo para documentos del cliente
interface ClientDocument {
  id: string;
  client_id: string;
  tenant_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

interface Client360ViewProps {
  client: Client;
}

export function Client360View({ client }: Client360ViewProps) {
  const { tenantId } = useTenant();
  const [policies, setPolicies] = useState<PolicyWithGroup[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(true);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  // =====================================================
  // CARGA DE PÓLIZAS (con nombre de grupo)
  // =====================================================
  const loadPolicies = useCallback(async () => {
    if (!tenantId || !client.id) return;

    setIsLoadingPolicies(true);
    try {
      const supabase = getBrowserClient();

      const { data, error } = await supabase
        .from('policies')
        .select('*, insurance_groups(name)')
        .eq('tenant_id', tenantId)
        .eq('client_id', client.id)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error loading policies:', error);
      } else {
        setPolicies((data || []) as PolicyWithGroup[]);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
    }
    setIsLoadingPolicies(false);
  }, [tenantId, client.id]);

  // =====================================================
  // CARGA DE DOCUMENTOS
  // =====================================================
  const loadDocuments = useCallback(async () => {
    if (!tenantId || !client.id) return;

    setIsLoadingDocuments(true);
    try {
      const supabase = getBrowserClient();

      const { data, error } = await (supabase as any)
        .from('client_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading documents:', error);
      } else {
        setDocuments((data || []) as ClientDocument[]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
    setIsLoadingDocuments(false);
  }, [tenantId, client.id]);

  useEffect(() => {
    if (tenantId && client.id) {
      loadPolicies();
      loadDocuments();
    }
  }, [tenantId, client.id, loadPolicies, loadDocuments]);

  const activePolicies = policies.filter(p => p.status === 'activa');
  const totalPremium = activePolicies.reduce((sum, p) => sum + Number(p.premium), 0);

  // =====================================================
  // AGRUPAR PÓLIZAS POR AÑO DE EMISIÓN (start_date)
  // =====================================================
  const policiesByYear = policies.reduce((acc, policy) => {
    const year = policy.start_date
      ? new Date(policy.start_date).getFullYear().toString()
      : 'Sin fecha';
    if (!acc[year]) acc[year] = [];
    acc[year].push(policy);
    return acc;
  }, {} as Record<string, PolicyWithGroup[]>);

  const sortedYears = Object.keys(policiesByYear).sort((a, b) => {
    if (a === 'Sin fecha') return 1;
    if (b === 'Sin fecha') return -1;
    return Number(b) - Number(a);
  });

  // =====================================================
  // VERIFICAR SI UN DOCUMENTO NECESITA ACTUALIZACIÓN (>1 año)
  // =====================================================
  const needsUpdate = (createdAt: string): boolean => {
    const uploadDate = new Date(createdAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return uploadDate < oneYearAgo;
  };

  // =====================================================
  // DESCARGAR DOCUMENTO CON SIGNED URL
  // =====================================================
  const handleDownloadDocument = async (doc: ClientDocument) => {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_url, 60);

      if (error || !data?.signedUrl) {
        console.error('Error generating signed URL:', error);
        return;
      }
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="polizas" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Pólizas</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
          <TabsTrigger value="siniestros" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Siniestros</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Pólizas */}
        <TabsContent value="polizas">
          <Card>
            <CardHeader>
              <CardTitle>Pólizas del Cliente</CardTitle>
              <CardDescription>
                Historial completo de pólizas agrupadas por año de emisión
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
                <div className="space-y-6">
                  {sortedYears.map((year) => (
                    <div key={year}>
                      {/* Encabezado del año */}
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          {year}
                        </h3>
                        <div className="flex-1 border-t border-dashed" />
                        <span className="text-xs text-muted-foreground">
                          {policiesByYear[year].length} póliza{policiesByYear[year].length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Tarjetas compactas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {policiesByYear[year].map((policy) => (
                          <Link key={policy.id} href={`/polizas/${policy.id}`}>
                            <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                              {/* Fila 1: Número + Estado */}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold">#{policy.policy_number}</span>
                                <Badge className={`text-xs ${POLICY_STATUS_COLORS[policy.status as PolicyStatus]}`}>
                                  {POLICY_STATUS_LABELS[policy.status as PolicyStatus]}
                                </Badge>
                              </div>

                              {/* Fila 2: Compañía */}
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Building className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{policy.insurer}</span>
                              </div>

                              {/* Fila 3: Grupo y Ramo */}
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {policy.insurance_groups?.name && (
                                  <span className="flex items-center gap-1">
                                    <Layers className="w-3 h-3 flex-shrink-0" />
                                    {policy.insurance_groups.name}
                                  </span>
                                )}
                                <span>
                                  {POLICY_LINE_LABELS[policy.line as PolicyLine] || policy.line}
                                </span>
                              </div>

                              {/* Fila 4: Vigencia y Prima */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(policy.start_date)} - {formatDate(policy.end_date)}
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatPremium(Number(policy.premium), policy.currency)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle>Documentos del Cliente</CardTitle>
              <CardDescription>
                Archivos adjuntos cargados en la hoja de vida
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDocuments ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Cargando documentos...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay documentos cargados</p>
                  <Link href={`/clientes/${client.id}/editar`}>
                    <Button variant="outline" className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Cargar Documentos
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.document_type}</p>
                          <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cargado: {formatDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {needsUpdate(doc.created_at) && (
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 bg-amber-50 whitespace-nowrap">
                            <Clock className="w-3 h-3 mr-1" />
                            Solicitar Actualización
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadDocument(doc)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Siniestros */}
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
      </Tabs>
    </div>
  );
}
