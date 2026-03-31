'use client';

// =====================================================
// PÁGINA: Cancelar Póliza
// /polizas/cancelar?poliza=[id]
// Crea un anexo de cancelación y cambia estado a cancelada
// =====================================================

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Policy } from '@/lib/validations/policies';
import { ArrowLeft, XCircle, FileText, Loader2, Save, Upload, File, Trash2 } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { getBrowserClient } from '@/lib/supabase/client';

interface UploadedDoc {
  id: string;
  file_name: string;
  file_url: string;
}

function CancelPolicyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const originalPolicyId = searchParams.get('poliza');
  const { isLoading: isLoadingTenant, tenantId, userId } = useTenant();

  const [originalPolicy, setOriginalPolicy] = useState<Policy | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [nextAnexo, setNextAnexo] = useState('01');
  const [fechaExpedicion, setFechaExpedicion] = useState(new Date().toISOString().split('T')[0]);
  const [premium, setPremium] = useState('');
  const [premiumValue, setPremiumValue] = useState(0);
  const [notas, setNotas] = useState('');

  // Documents
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const parseCurrencyValue = (value: string): number => {
    const isNegative = value.includes('-');
    const cleaned = value.replace(/[^0-9]/g, '');
    const numericValue = parseInt(cleaned, 10) || 0;
    return isNegative ? -numericValue : numericValue;
  };

  const loadOriginalPolicy = useCallback(async () => {
    if (!tenantId || !originalPolicyId) return;

    setIsLoadingPolicy(true);
    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('policies')
        .select(`
          *,
          clients!inner(id, full_name),
          insurance_company:insurance_companies(id, name, slug),
          insurance_line:insurance_lines(id, name, slug),
          insurance_group:insurance_groups(id, name, slug)
        `)
        .eq('id', originalPolicyId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) {
        setError('No se pudo cargar la póliza');
      } else {
        setOriginalPolicy(data as Policy);

        // Calcular siguiente anexo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingAnexos } = await (supabase as any)
          .from('policies')
          .select('anexo')
          .eq('policy_number', data.policy_number)
          .eq('tenant_id', tenantId)
          .order('anexo', { ascending: false })
          .limit(1);

        if (existingAnexos && existingAnexos.length > 0) {
          const lastAnexo = parseInt(existingAnexos[0].anexo || '00', 10);
          setNextAnexo(String(lastAnexo + 1).padStart(2, '0'));
        }
      }
    } catch {
      setError('Error de conexión');
    }
    setIsLoadingPolicy(false);
  }, [tenantId, originalPolicyId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId && originalPolicyId) {
      loadOriginalPolicy();
    }
  }, [isLoadingTenant, tenantId, originalPolicyId, loadOriginalPolicy]);

  const handlePremiumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseCurrencyValue(e.target.value);
    // Cancelación siempre negativa o 0
    const negativeValue = value > 0 ? -value : value;
    setPremiumValue(negativeValue);
    setPremium(formatCurrency(negativeValue));
  };

  const handleUploadDocument = async (file: globalThis.File) => {
    if (!tenantId || !originalPolicyId) return;

    setIsUploading(true);
    try {
      const supabase = getBrowserClient();

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${tenantId}/policies/${originalPolicyId}/cancelacion/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        setError(`Error al subir: ${uploadError.message}`);
      } else {
        setUploadedDocs(prev => [...prev, {
          id: `temp-${timestamp}`,
          file_name: file.name,
          file_url: path
        }]);
      }
    } catch {
      setError('Error al subir documento');
    }
    setIsUploading(false);
  };

  const handleRemoveDoc = (docId: string) => {
    setUploadedDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleSubmit = async () => {
    if (!tenantId || !userId || !originalPolicy || !originalPolicyId) return;

    if (!fechaExpedicion) {
      setError('La fecha de expedición es obligatoria');
      return;
    }

    if (!notas.trim()) {
      setError('Los comentarios son obligatorios para la cancelación');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opAny = originalPolicy as any;

      // 1. Crear el anexo de cancelación
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cancelAnexo, error: insertError } = await (supabase as any)
        .from('policies')
        .insert({
          tenant_id: tenantId,
          client_id: originalPolicy.client_id,
          policy_number: originalPolicy.policy_number,
          anexo: nextAnexo,
          insurer: originalPolicy.insurer,
          insurer_id: opAny.insurer_id || null,
          line: originalPolicy.line || 'otro',
          line_id: opAny.line_id || null,
          group_id: opAny.group_id || null,
          status: 'cancelada',
          currency: originalPolicy.currency || 'COP',
          premium: premiumValue,
          gastos_expedicion: 0,
          iva: 0,
          total_a_pagar: premiumValue,
          commission_pct: opAny.commission_pct || 0,
          fecha_expedicion: fechaExpedicion,
          start_date: originalPolicy.start_date || null,
          end_date: originalPolicy.end_date || null,
          notas: notas,
          policy_type: 'anexo',
          parent_policy_id: originalPolicyId,
          metadata: { cancellation_anexo: true }
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message || 'Error al crear el anexo de cancelación');
        setIsSaving(false);
        return;
      }

      // 2. Guardar documentos asociados al anexo de cancelación
      for (const doc of uploadedDocs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('policy_documents')
          .insert({
            tenant_id: tenantId,
            policy_id: cancelAnexo.id,
            document_type: 'soporte',
            document_name: 'Documento de cancelación',
            file_url: doc.file_url,
            file_name: doc.file_name
          });
      }

      // 3. Cambiar estado de la póliza base y todos sus anexos a "cancelada"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allPolicies } = await (supabase as any)
        .from('policies')
        .select('id')
        .eq('policy_number', originalPolicy.policy_number)
        .eq('tenant_id', tenantId)
        .neq('status', 'cancelada')
        .neq('status', 'inactiva');

      if (allPolicies) {
        for (const p of allPolicies) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('policies')
            .update({
              status: 'cancelada',
              updated_at: new Date().toISOString()
            })
            .eq('id', (p as { id: string }).id)
            .eq('tenant_id', tenantId);
        }
      }

      // 4. Redirigir al detalle de la póliza
      router.push(`/polizas/${originalPolicyId}`);

    } catch {
      setError('Error de conexión');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalPolicyId) {
      router.push(`/polizas/${originalPolicyId}`);
    } else {
      router.push('/polizas');
    }
  };

  if (isLoadingTenant || isLoadingPolicy) {
    return <LoadingScreen />;
  }

  if (!originalPolicy) {
    return (
      <div className="container mx-auto py-6 px-4 text-center">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-muted-foreground mt-2">{error || 'Póliza no encontrada'}</p>
        <Link href="/polizas">
          <Button variant="outline" className="mt-4">Volver a Pólizas</Button>
        </Link>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opAny = originalPolicy as any;
  const clientName = opAny.clients?.full_name || 'Cliente';

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleCancel} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <XCircle className="h-6 w-6 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cancelar Póliza</h1>
          <p className="text-sm text-muted-foreground">
            Cancelación de {originalPolicy.policy_number} - {clientName}
          </p>
        </div>
      </div>

      {/* Info de la póliza */}
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-red-700" />
            <span className="font-semibold text-red-800">Póliza a Cancelar</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Número</span>
              <p className="font-medium">{originalPolicy.policy_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Aseguradora</span>
              <p className="font-medium">{opAny.insurance_company?.name || originalPolicy.insurer}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Prima</span>
              <p className="font-medium">{formatCurrency(originalPolicy.premium || 0)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vigencia</span>
              <p className="font-medium">
                {originalPolicy.end_date
                  ? new Date(originalPolicy.end_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Formulario de cancelación */}
      <Card>
        <CardHeader>
          <CardTitle>Anexo de Cancelación</CardTitle>
          <CardDescription>
            Complete los datos del anexo de cancelación. Todos los campos marcados con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Identificación */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Número de Póliza</Label>
              <Input value={originalPolicy.policy_number} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Anexo de Cancelación</Label>
              <Input value={nextAnexo} disabled className="bg-slate-50 font-semibold" />
              <p className="text-xs text-muted-foreground mt-1">Calculado automáticamente</p>
            </div>
            <div>
              <Label>Fecha de Expedición *</Label>
              <Input
                type="date"
                value={fechaExpedicion}
                onChange={(e) => setFechaExpedicion(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Valor de devolución */}
          <div>
            <Label>Prima de Cancelación (valor negativo o $0)</Label>
            <Input
              value={premium}
              onChange={handlePremiumChange}
              onFocus={(e) => e.target.select()}
              disabled={isSaving}
              placeholder="$ 0"
              className={premiumValue < 0 ? 'text-red-600 font-bold' : ''}
            />
            {premiumValue < 0 && (
              <p className="text-xs text-red-600 mt-1">
                Devolución de {formatCurrency(Math.abs(premiumValue))} a favor del cliente
              </p>
            )}
          </div>

          {/* Comentarios */}
          <div>
            <Label>Motivo de Cancelación *</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Describa el motivo de la cancelación de la póliza..."
              disabled={isSaving}
              rows={4}
            />
          </div>

          {/* Documentos */}
          <div>
            <Label>Documentos de Soporte</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Adjunte los documentos relacionados con la cancelación (carta de cancelación, etc.)
            </p>

            {uploadedDocs.length > 0 && (
              <div className="space-y-2 mb-3">
                {uploadedDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{doc.file_name}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveDoc(doc.id)} className="h-8 w-8 p-0 hover:bg-red-100">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadDocument(file);
                  e.target.value = '';
                }}
                className="hidden"
                disabled={isUploading || isSaving}
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isUploading ? 'Subiendo...' : 'Adjuntar documento'}
                </span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
          Volver
        </Button>
        <Button variant="destructive" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
          ) : (
            <><XCircle className="mr-2 h-4 w-4" />Confirmar Cancelación</>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function CancelPolicyPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CancelPolicyContent />
    </Suspense>
  );
}
