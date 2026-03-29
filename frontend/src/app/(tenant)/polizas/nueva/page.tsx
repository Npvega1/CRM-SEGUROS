'use client';

// =====================================================
// PÁGINA: Nueva Póliza
// /polizas/nueva
// =====================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm, type PolicyDocument } from '@/components/modules/policies/PolicyForm';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search, Loader2, User, Check } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { getBrowserClient } from '@/lib/supabase/client';

interface PolicyFormData {
  client_id: string;
  policy_number: string;
  anexo?: string;
  insurer: string;
  insurer_id?: string;
  line: string;
  line_id?: string;
  group_id?: string;
  status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
  premium: number;
  gastos_expedicion?: number;
  iva?: number;
  total_a_pagar?: number;
  currency?: string;
  start_date?: string | null;
  end_date?: string | null;
  fecha_expedicion?: string | null;
  commission_pct?: number;
  metadata?: Record<string, unknown>;
}

function NewPolicyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');
  const { isLoading: isLoadingTenant, tenantId, userId } = useTenant();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [clientSearch, setClientSearch] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => {
    async function loadClients() {
      if (!tenantId) return;

      setIsLoadingClients(true);
      try {
        const supabase = getBrowserClient();
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('full_name', { ascending: true })
          .limit(100);

        setClients((data || []) as Client[]);
      } catch (err) {
        console.error('Error loading clients:', err);
      }
      setIsLoadingClients(false);
    }
    if (tenantId) {
      loadClients();
    }
  }, [tenantId]);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.doc_number.includes(clientSearch)
  );

  // Función para subir documentos a Supabase Storage
  const uploadDocuments = async (
    policyId: string,
    documents: PolicyDocument[]
  ): Promise<{ success: boolean; uploadedCount: number; errors: string[] }> => {
    const errors: string[] = [];
    let uploadedCount = 0;
    const supabase = getBrowserClient();

    for (const doc of documents) {
      if (!doc.file) continue;

      try {
        const timestamp = Date.now();
        const sanitizedFileName = doc.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${tenantId}/policies/${policyId}/${doc.document_type}/${timestamp}_${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('policy-documents')
          .upload(filePath, doc.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          errors.push(`Error subiendo ${doc.file_name}: ${uploadError.message}`);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('policy-documents')
          .getPublicUrl(filePath);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('policy_documents')
          .insert({
            tenant_id: tenantId,
            policy_id: policyId,
            document_type: doc.document_type,
            document_name: doc.document_name || doc.file_name,
            file_url: publicUrlData.publicUrl,
            file_name: doc.file_name
          });

        if (insertError) {
          console.error('Error inserting document record:', insertError);
          errors.push(`Error registrando ${doc.file_name}: ${insertError.message}`);
          continue;
        }

        uploadedCount++;
        setUploadProgress(`Subiendo documentos: ${uploadedCount}/${documents.length}`);
      } catch (err) {
        console.error('Error processing document:', err);
        errors.push(`Error procesando ${doc.file_name}`);
      }
    }

    return { success: errors.length === 0, uploadedCount, errors };
  };

  // handleSubmit para recibir documentos
  const handleSubmit = async (
    data: PolicyFormData,
    polizaDocuments: PolicyDocument[],
    soporteDocuments: PolicyDocument[]
  ) => {
    if (!selectedClientId) {
      setError('Debes seleccionar un cliente');
      return;
    }

    if (!tenantId || !userId) {
      setError('No hay sesión activa');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUploadProgress(null);

    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newPolicy, error: insertError } = await (supabase as any)
        .from('policies')
        .insert({
          tenant_id: tenantId,
          client_id: selectedClientId,
          policy_number: data.policy_number,
          anexo: data.anexo || '00',
          insurer: data.insurer,
          insurer_id: data.insurer_id || null,
          line: data.line,
          line_id: data.line_id || null,
          group_id: data.group_id || null,
          status: data.status || 'activa',
          premium: data.premium,
          gastos_expedicion: data.gastos_expedicion || 0,
          iva: data.iva || 0,
          total_a_pagar: data.total_a_pagar || 0,
          currency: data.currency || 'COP',
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          fecha_expedicion: data.fecha_expedicion || null,
          commission_pct: data.commission_pct || 10,
          metadata: data.metadata || {}
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message || 'Error al crear la póliza');
        setIsLoading(false);
        return;
      }

      // Subir documentos si hay alguno
      const allDocuments = [...polizaDocuments, ...soporteDocuments];
      
      if (allDocuments.length > 0) {
        setUploadProgress('Subiendo documentos...');
        const uploadResult = await uploadDocuments(newPolicy.id, allDocuments);
        
        if (!uploadResult.success) {
          console.warn('Algunos documentos no se subieron:', uploadResult.errors);
        }
      }

      router.push(`/polizas/${newPolicy.id}`);
      
    } catch (err) {
      console.error('Error creating policy:', err);
      setError('Error de conexión');
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/polizas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Pólizas
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {uploadProgress && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          {uploadProgress}
        </div>
      )}

      {/* ✅ NUEVO LAYOUT: Cliente arriba, formulario abajo */}
      <div className="space-y-6">
        
        {/* Sección 1: Selección de Cliente (arriba, ancho completo) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Seleccionar Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedClient ? (
              // Cliente seleccionado - mostrar resumen compacto
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedClient.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedClient.doc_type}: {selectedClient.doc_number}
                      {selectedClient.email && ` • ${selectedClient.email}`}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedClientId('')}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              // Buscador de clientes
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o documento..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando clientes...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setSelectedClientId(client.id)}
                        className="text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 hover:border-primary"
                      >
                        <p className="font-medium truncate">{client.full_name}</p>
                        <p className="text-sm text-muted-foreground">{client.doc_number}</p>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="col-span-full text-center text-muted-foreground py-4">
                        No se encontraron clientes
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sección 2: Formulario de Póliza (abajo, ancho completo) */}
        {selectedClientId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Datos de la Póliza
              </CardTitle>
              <CardDescription>
                Nueva póliza para {selectedClient?.full_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PolicyForm
                clientId={selectedClientId}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* Mensaje si no hay cliente seleccionado */}
        {!selectedClientId && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4 opacity-50" />
              <p>Selecciona un cliente para crear la póliza</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function NewPolicyPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <NewPolicyContent />
    </Suspense>
  );
}
