'use client';

// =====================================================
// PÁGINA: Nueva Póliza
// /polizas/nueva
// Usa Supabase Client directo (evita API Routes con problemas de proxy)
// =====================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PolicyForm, type PolicyDocument } from '@/components/modules/policies/PolicyForm';
import type { Client } from '@/lib/validations/clients';
import { ArrowLeft, Shield, AlertCircle, Search, Loader2 } from 'lucide-react';
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
  const { isLoading: isLoadingTenant, tenantName, tenantId, userId } = useTenant();

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

  // ✅ FUNCIÓN PARA SUBIR DOCUMENTOS A SUPABASE STORAGE
  const uploadDocuments = async (
    supabase: ReturnType<typeof getBrowserClient>,
    policyId: string,
    documents: PolicyDocument[]
  ): Promise<{ success: boolean; uploadedCount: number; errors: string[] }> => {
    const errors: string[] = [];
    let uploadedCount = 0;

    for (const doc of documents) {
      if (!doc.file) continue;

      try {
        const timestamp = Date.now();
        const sanitizedFileName = doc.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${tenantId}/policies/${policyId}/${doc.document_type}/${timestamp}_${sanitizedFileName}`;

        // Subir archivo a Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
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

        // Obtener URL pública
        const { data: publicUrlData } = supabase.storage
          .from('policy-documents')
          .getPublicUrl(filePath);

        // Insertar registro en policy_documents
        const { error: insertError } = await supabase
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

  // ✅ HANDLESUBMIT ACTUALIZADO PARA RECIBIR DOCUMENTOS
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

      // 1. Insertar la póliza con todos los campos nuevos
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

      // 2. Subir documentos si hay alguno
      const allDocuments = [...polizaDocuments, ...soporteDocuments];
      
      if (allDocuments.length > 0) {
        setUploadProgress('Subiendo documentos...');
        
        const uploadResult = await uploadDocuments(supabase, newPolicy.id, allDocuments);
        
        if (!uploadResult.success) {
          console.warn('Algunos documentos no se subieron:', uploadResult.errors);
          // No bloqueamos la creación de la póliza, solo mostramos advertencia
        }
        
        console.log(`Documentos subidos: ${uploadResult.uploadedCount}/${allDocuments.length}`);
      }

      // 3. Redirigir al detalle de la póliza
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
    <div className="container mx-auto px-4 py-6 max-w-6xl">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Selection */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Seleccionar Cliente</CardTitle>
            <CardDescription>Busca y selecciona el cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o documento..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoadingClients ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Cargando clientes...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedClientId === client.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium">{client.full_name}</p>
                    <p className="text-sm text-muted-foreground">{client.doc_number}</p>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No se encontraron clientes
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policy Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Datos de la Póliza
            </CardTitle>
            <CardDescription>
              {selectedClient
                ? `Póliza para: ${selectedClient.full_name}`
                : 'Selecciona un cliente primero'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedClientId ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mb-4" />
                <p>Selecciona un cliente para crear la póliza</p>
              </div>
            ) : (
              <PolicyForm
                clientId={selectedClientId}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            )}
          </CardContent>
        </Card>
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
