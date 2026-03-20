'use client';

// =====================================================
// PÁGINA: Reportar Nuevo Siniestro
// Módulo 07: Portal del Cliente
// Formulario para crear siniestro desde el portal
// =====================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePortal } from '@/lib/context/PortalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortalClaimRequestSchema, type PortalClaimRequest } from '@/lib/validations/portal';
import {
  AlertTriangle,
  ArrowLeft,
  Upload,
  X,
  CheckCircle2,
  FileText,
  Calendar,
  Building2
} from 'lucide-react';

// Tipos
interface Policy {
  id: string;
  policy_number: string;
  insurer: string;
  line: string;
  status: string;
}

const POLICY_LINE_LABELS: Record<string, string> = {
  vida: 'Vida',
  auto: 'Auto',
  salud: 'Salud',
  hogar: 'Hogar',
  soat: 'SOAT',
  otro: 'Otro'
};

export default function PortalNewClaimPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug as string;
  const { client } = usePortal();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<PortalClaimRequest>({
    resolver: zodResolver(PortalClaimRequestSchema),
    defaultValues: {
      incident_date: new Date().toISOString().split('T')[0]
    }
  });

  const selectedPolicyId = watch('policy_id');
  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);

  // Cargar pólizas activas
  useEffect(() => {
    async function loadPolicies() {
      if (!client.client_id || !client.tenant_id) return;

      try {
        const { data, error } = await supabase
          .from('policies')
          .select('id, policy_number, insurer, line, status')
          .eq('tenant_id', client.tenant_id)
          .eq('client_id', client.client_id)
          .eq('status', 'activa');

        if (error) throw error;
        setPolicies(data || []);
      } catch (e) {
        console.error('Error loading policies:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadPolicies();
  }, [supabase, client.client_id, client.tenant_id]);

  // Manejar archivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles].slice(0, 5)); // Máximo 5 archivos
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Enviar formulario
  const onSubmit = async (data: PortalClaimRequest) => {
    if (!client.client_id || !client.tenant_id) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Crear el siniestro
      const { data: newClaim, error: claimError } = await supabase
        .from('claims')
        .insert({
          tenant_id: client.tenant_id,
          client_id: client.client_id,
          policy_id: data.policy_id,
          agent_id: client.agent_id,
          incident_date: data.incident_date,
          claimed_amount: 0, // Se determina después
          description: data.description,
          status: 'reported'
        })
        .select('id')
        .single();

      if (claimError) throw claimError;

      // Subir archivos si hay
      if (files.length > 0 && newClaim?.id) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const filePath = `${client.tenant_id}/${newClaim.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('claim-documents')
            .upload(filePath, file);

          if (!uploadError) {
            // Registrar documento
            await supabase
              .from('claim_documents')
              .insert({
                claim_id: newClaim.id,
                tenant_id: client.tenant_id,
                file_name: file.name,
                file_url: filePath,
                file_type: file.type,
                file_size: file.size
              });
          }
        }
      }

      // Crear solicitud del cliente
      await supabase
        .from('client_requests')
        .insert({
          tenant_id: client.tenant_id,
          client_id: client.client_id,
          type: 'new_claim',
          status: 'open',
          description: data.description,
          policy_id: data.policy_id,
          claim_id: newClaim?.id,
          assigned_agent_id: client.agent_id
        });

      setIsSuccess(true);

    } catch (e) {
      console.error('Error creating claim:', e);
      setError('Error al reportar el siniestro. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pantalla de éxito
  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto" data-testid="portal-claim-success">
        <Card className="shadow-lg">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Siniestro Reportado!
            </h2>
            <p className="text-muted-foreground mb-6">
              Tu reporte ha sido enviado exitosamente. Un agente se pondrá en contacto contigo pronto.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => router.push(`/${tenantSlug}/claims`)}>
                Ver mis siniestros
              </Button>
              <Button variant="outline" onClick={() => router.push(`/${tenantSlug}/dashboard`)}>
                Ir al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="portal-new-claim">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          data-testid="portal-claim-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportar Siniestro</h1>
          <p className="text-muted-foreground">
            Completa el formulario para reportar un incidente
          </p>
        </div>
      </div>

      {/* Sin pólizas activas */}
      {!isLoading && policies.length === 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-orange-900">
                  No tienes pólizas activas
                </h3>
                <p className="text-sm text-orange-800 mt-1">
                  Para reportar un siniestro necesitas tener al menos una póliza activa. 
                  Contacta a tu agente si crees que esto es un error.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulario */}
      {policies.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Información del Siniestro
            </CardTitle>
            <CardDescription>
              Proporciona los detalles del incidente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                  {error}
                </div>
              )}

              {/* Selección de póliza */}
              <div className="space-y-2">
                <Label>Póliza afectada *</Label>
                <Select
                  value={selectedPolicyId}
                  onValueChange={(value) => setValue('policy_id', value)}
                >
                  <SelectTrigger data-testid="portal-claim-policy-select">
                    <SelectValue placeholder="Selecciona una póliza" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map(policy => (
                      <SelectItem key={policy.id} value={policy.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {POLICY_LINE_LABELS[policy.line] || policy.line}
                          </span>
                          <span className="text-muted-foreground">
                            - {policy.policy_number}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.policy_id && (
                  <p className="text-sm text-red-600">{errors.policy_id.message}</p>
                )}
              </div>

              {/* Info de póliza seleccionada */}
              {selectedPolicy && (
                <div className="bg-slate-50 rounded-lg p-4 flex items-center gap-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedPolicy.insurer}</p>
                    <p className="text-sm text-muted-foreground">
                      Póliza N° {selectedPolicy.policy_number}
                    </p>
                  </div>
                </div>
              )}

              {/* Fecha del incidente */}
              <div className="space-y-2">
                <Label htmlFor="incident_date">Fecha del incidente *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="incident_date"
                    type="date"
                    className="pl-10"
                    max={new Date().toISOString().split('T')[0]}
                    {...register('incident_date')}
                    data-testid="portal-claim-date"
                  />
                </div>
                {errors.incident_date && (
                  <p className="text-sm text-red-600">{errors.incident_date.message}</p>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción del incidente *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe qué sucedió, dónde y cómo ocurrió el incidente..."
                  className="min-h-[120px]"
                  {...register('description')}
                  data-testid="portal-claim-description"
                />
                {errors.description && (
                  <p className="text-sm text-red-600">{errors.description.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Incluye todos los detalles relevantes: fecha, hora, lugar, circunstancias, 
                  daños o pérdidas, y cualquier otra información importante.
                </p>
              </div>

              {/* Carga de archivos */}
              <div className="space-y-2">
                <Label>Evidencias (opcional)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arrastra archivos aquí o haz clic para seleccionar
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    data-testid="portal-claim-files"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Seleccionar archivos
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Máximo 5 archivos. Formatos: imágenes, PDF, DOC
                  </p>
                </div>

                {/* Lista de archivos */}
                {files.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {files.map((file, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                  data-testid="portal-claim-submit"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    'Reportar Siniestro'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Información adicional */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium text-gray-900 mb-3">¿Qué sigue después?</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Tu agente recibirá una notificación del reporte</li>
            <li>Revisará la información y te contactará si necesita más detalles</li>
            <li>Se iniciará el proceso con la aseguradora</li>
            <li>Podrás seguir el estado de tu siniestro desde el portal</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
