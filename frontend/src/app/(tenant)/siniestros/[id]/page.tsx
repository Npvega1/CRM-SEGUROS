'use client';

// =====================================================
// PÁGINA: Detalle del Siniestro
// /siniestros/[id]
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBrowserClient } from '@/lib/supabase/client';
import { ClaimStatusStepper, ClaimTimeline, ClaimDocuments } from '@/components/modules/claims';
import {
  type ClaimExpediente,
  type ClaimStatus,
  type ClaimDocument,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatClaimAmount,
  formatClaimDate,
  formatClaimDateTime,
  isValidClaimStatusTransition
} from '@/lib/validations/claims';
import {
  ArrowLeft,
  FileWarning,
  User,
  Phone,
  Mail,
  Shield,
  Calendar,
  DollarSign,
  Clock,
  History,
  Paperclip
} from 'lucide-react';

export default function ClaimDetailPage() {
  const params = useParams();
  const claimId = params.id as string;
  const { isLoading: isLoadingTenant, tenantId, userId } = useTenant();

  const [expediente, setExpediente] = useState<ClaimExpediente | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [approvedAmount, setApprovedAmount] = useState<string>('');
  const [showApprovedEdit, setShowApprovedEdit] = useState(false);

  const loadExpediente = useCallback(async () => {
    if (!tenantId || !claimId) return;

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      // Cargar siniestro con relaciones
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: claimData, error: claimError } = await (supabase as any)
        .from('claims')
        .select(`
          *,
          policies!inner(id, policy_number, insurer, line, status, premium, start_date, end_date),
          clients!inner(id, full_name, doc_type, doc_number, email, phone, segment),
          users(id, full_name)
        `)
        .eq('id', claimId)
        .eq('tenant_id', tenantId)
        .single();

      if (claimError || !claimData) {
        console.error('Error loading claim:', claimError);
        setIsLoading(false);
        return;
      }

      // Cargar historial
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: historyData } = await (supabase as any)
        .from('claims_history')
        .select(`
          *,
          users(full_name)
        `)
        .eq('claim_id', claimId)
        .order('changed_at', { ascending: false });

      // Cargar documentos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: docsData } = await (supabase as any)
        .from('claim_documents')
        .select(`
          *,
          users(full_name)
        `)
        .eq('claim_id', claimId)
        .order('uploaded_at', { ascending: false });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const claimDataTyped = claimData as any;
      const exp: ClaimExpediente = {
        claim: {
          ...claimDataTyped,
          agent_name: claimDataTyped.users?.full_name || undefined
        },
        policy: claimDataTyped.policies as ClaimExpediente['policy'],
        client: claimDataTyped.clients as ClaimExpediente['client'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        history: (historyData || []).map((h: any) => ({
          ...h,
          changed_by_name: h.users?.full_name || null
        })) as ClaimExpediente['history'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        documents: (docsData || []).map((d: any) => ({
          ...d,
          uploader_name: d.users?.full_name || null
        })) as ClaimExpediente['documents']
      };

      setExpediente(exp);
      setApprovedAmount(exp.claim.approved_amount?.toString() || '');
    } catch (error) {
      console.error('Error loading expediente:', error);
    }
    setIsLoading(false);
  }, [tenantId, claimId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadExpediente();
    }
  }, [isLoadingTenant, tenantId, loadExpediente]);

  const handleStatusChange = async (newStatus: ClaimStatus, comment: string) => {
    if (!expediente || !userId || !tenantId) {
      console.error('Missing required data:', { expediente: !!expediente, userId, tenantId });
      alert('Faltan datos requeridos');
      return;
    }

    const currentStatus = expediente.claim.status as ClaimStatus;
    if (!isValidClaimStatusTransition(currentStatus, newStatus)) {
      alert('Transición de estado no válida');
      return;
    }

    setIsUpdating(true);
    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('claims')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', claimId)
        .eq('tenant_id', tenantId)
        .select();

      if (updateError) {
        console.error('Error updating status:', updateError);
        alert('Error al actualizar el estado: ' + (updateError.message || JSON.stringify(updateError)));
        setIsUpdating(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('claims_history')
        .insert({
          claim_id: claimId,
          changed_by: userId,
          old_status: currentStatus,
          new_status: newStatus,
          comment: comment || null,
          is_internal: false
        })
        .select();

      await loadExpediente();
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Error al cambiar el estado: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
    setIsUpdating(false);
  };

  const handleUpdateApprovedAmount = async () => {
    if (!expediente || !userId || !tenantId) return;

    const amount = parseFloat(approvedAmount) || 0;
    if (amount < 0) {
      alert('El monto aprobado no puede ser negativo');
      return;
    }

    setIsUpdating(true);
    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('claims')
        .update({ 
          approved_amount: amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', claimId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error updating approved amount:', error);
        alert('Error al actualizar el monto: ' + (error.message || 'Error desconocido'));
      } else {
        setShowApprovedEdit(false);
        await loadExpediente();
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setIsUpdating(false);
  };

  const handleUploadDocuments = async (files: File[]) => {
    if (!expediente || !tenantId || !userId) return;

    setIsUploading(true);
    const newProgress: Record<string, number> = {};
    files.forEach(f => { newProgress[f.name] = 0; });
    setUploadProgress(newProgress);

    const supabase = getBrowserClient();

    for (const file of files) {
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${tenantId}/${claimId}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('claim-documents')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        setUploadProgress(prev => ({ ...prev, [file.name]: 50 }));

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setUploadProgress(prev => ({ ...prev, [file.name]: -1 }));
          continue;
        }

        // Guardar solo el path relativo (NO la URL pública)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('claim_documents')
          .insert({
            claim_id: claimId,
            tenant_id: tenantId,
            uploader_id: userId,
            file_name: file.name,
            file_url: storagePath,
            file_type: file.type || file.name.split('.').pop() || 'pdf',
            file_size: file.size
          });

        if (insertError) {
          console.error('Insert document error:', insertError);
        }

        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      } catch (error) {
        console.error('Error uploading file:', error);
        setUploadProgress(prev => ({ ...prev, [file.name]: -1 }));
      }
    }

    setTimeout(() => {
      setUploadProgress({});
      setIsUploading(false);
      loadExpediente();
    }, 1000);
  };

  const handleGetSignedUrl = async (doc: ClaimDocument): Promise<string | null> => {
    try {
      const supabase = getBrowserClient();
      
      // Extraer el path limpio del storage
      let storagePath = doc.file_url;
      // Si contiene la URL completa del bucket, extraer solo el path
      if (storagePath.includes('/claim-documents/')) {
        storagePath = storagePath.split('/claim-documents/').pop() || storagePath;
      }

      const { data, error } = await supabase.storage
        .from('claim-documents')
        .createSignedUrl(storagePath, 3600);

      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  };

  if (isLoadingTenant || isLoading) {
    return <LoadingScreen message="Cargando expediente..." />;
  }

  if (!expediente) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Siniestro no encontrado</h2>
            <p className="text-muted-foreground mb-4">
              El siniestro solicitado no existe o no tienes permisos para verlo.
            </p>
            <Link href="/siniestros">
              <Button>Volver a Siniestros</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { claim, policy, client, history, documents } = expediente;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/siniestros">
            <Button variant="ghost" size="icon" data-testid="back-to-claims">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileWarning className="h-6 w-6 text-primary" />
              Siniestro #{claimId.slice(0, 8).toUpperCase()}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={CLAIM_STATUS_COLORS[claim.status as ClaimStatus]}>
                {CLAIM_STATUS_LABELS[claim.status as ClaimStatus]}
              </Badge>
              <span className="text-muted-foreground">
                Póliza: {policy.policy_number}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Stepper */}
      <Card>
        <CardContent className="pt-6">
          <ClaimStatusStepper currentStatus={claim.status as ClaimStatus} />
        </CardContent>
      </Card>

      {/* Main Content - Two Columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileWarning className="h-5 w-5" />
                Información del Siniestro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Fecha del Incidente
                  </p>
                  <p className="font-medium">{formatClaimDate(claim.incident_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Fecha de Reporte
                  </p>
                  <p className="font-medium">{formatClaimDateTime(claim.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" /> Monto Reclamado
                  </p>
                  <p className="font-semibold text-lg">{formatClaimAmount(claim.claimed_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" /> Monto Aprobado
                  </p>
                  {showApprovedEdit ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={approvedAmount}
                        onChange={(e) => setApprovedAmount(e.target.value)}
                        className="w-32 h-8"
                        data-testid="approved-amount-input"
                      />
                      <Button
                        size="sm"
                        onClick={handleUpdateApprovedAmount}
                        disabled={isUpdating}
                        data-testid="save-approved-btn"
                      >
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowApprovedEdit(false);
                          setApprovedAmount(claim.approved_amount?.toString() || '');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg text-green-600">
                        {claim.approved_amount != null ? formatClaimAmount(claim.approved_amount || 0) : '-'}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowApprovedEdit(true)}
                        data-testid="edit-approved-btn"
                      >
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-4 w-4" /> Agente Asignado
                  </p>
                  <p className="font-medium">{claim.agent_name || 'Sin asignar'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                <p className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                  {claim.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Policy Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Información de la Póliza
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Número de Póliza</p>
                  <p className="font-medium">{policy.policy_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aseguradora</p>
                  <p className="font-medium">{policy.insurer}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ramo</p>
                  <Badge variant="outline">
                    {POLICY_LINE_LABELS[policy.line] || policy.line}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prima</p>
                  <p className="font-medium">{formatClaimAmount(policy.premium)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vigencia</p>
                  <p className="font-medium">
                    {formatClaimDate(policy.start_date)} - {formatClaimDate(policy.end_date)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{client.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <p className="font-medium">{client.doc_type.toUpperCase()}: {client.doc_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="font-medium">{client.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Teléfono
                  </p>
                  <p className="font-medium">{client.phone || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Timeline & Documents */}
        <div className="space-y-6">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timeline" className="flex items-center gap-1" data-testid="tab-timeline">
                <History className="h-4 w-4" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-1" data-testid="tab-documents">
                <Paperclip className="h-4 w-4" />
                Documentos ({documents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Historial de Cambios</CardTitle>
                </CardHeader>
                <CardContent>
                  <ClaimTimeline
                    history={history}
                    currentStatus={claim.status as ClaimStatus}
                    onStatusChange={handleStatusChange}
                    isUpdating={isUpdating}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Documentos Adjuntos</CardTitle>
                  <CardDescription>
                    Sube evidencias, informes y otros documentos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ClaimDocuments
                    documents={documents}
                    claimId={claimId}
                    tenantId={tenantId || ''}
                    onUpload={handleUploadDocuments}
                    onGetSignedUrl={handleGetSignedUrl}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
