'use client';

// =====================================================
// COMPONENTE: NewComparisonWizard
// Wizard para crear un nuevo comparativo
// Fase 4: Solo muestra grupos con has_ai_prompt = true
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientSearchSelect } from './ClientSearchSelect';
import { 
  isValidFile, 
  formatFileSize, 
  getFileType
} from '@/lib/validations/comparisons';
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { getBrowserClient } from '@/lib/supabase/client';
import { 
  Upload, 
  X, 
  FileText, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  User,
  UserPlus
} from 'lucide-react';

interface FileWithPreview extends File {
  id: string;
  base64?: string;
}

interface InsuranceLine {
  id: string;
  name: string;
  slug: string;
  has_ai_prompt: boolean;
}

interface NewComparisonWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    clientId?: string;
    prospectName?: string;
    line: PolicyLine;
    files: Array<{ name: string; type: string; size: number; base64: string }>;
  }) => Promise<void>;
  isProcessing?: boolean;
  processingProgress?: number;
}

export function NewComparisonWizard({
  open,
  onClose,
  onSubmit,
  isProcessing = false,
  processingProgress = 0
}: NewComparisonWizardProps) {
  const [step, setStep] = useState(1);
  const [clientMode, setClientMode] = useState<'existing' | 'prospect'>('existing');
  const [clientId, setClientId] = useState<string>('');
  const [prospectName, setProspectName] = useState<string>('');
  const [line, setLine] = useState<PolicyLine>('auto');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para grupos con AI prompt
  const [aiEnabledLines, setAiEnabledLines] = useState<InsuranceLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(true);

  // Cargar grupos con has_ai_prompt = true
  useEffect(() => {
    async function loadAiEnabledLines() {
      if (!open) return;
      setLoadingLines(true);

      try {
        const supabase = getBrowserClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('insurance_lines')
          .select('id, name, slug, has_ai_prompt')
          .eq('has_ai_prompt', true)
          .eq('is_active', true)
          .order('display_order');

        if (error) {
          console.error('Error loading AI-enabled lines:', error);
          // Fallback a líneas estáticas si hay error
          setAiEnabledLines([]);
        } else if (data && data.length > 0) {
          setAiEnabledLines(data);
          // Seleccionar la primera línea por defecto
          setLine(data[0].slug as PolicyLine);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoadingLines(false);
      }
    }

    loadAiEnabledLines();
  }, [open]);

  // Obtener el nombre del grupo seleccionado
  const getLineName = (lineSlug: string): string => {
    const found = aiEnabledLines.find(l => l.slug === lineSlug);
    if (found) return found.name;
    // Fallback a labels estáticos
    return POLICY_LINE_LABELS[lineSlug as PolicyLine] || lineSlug;
  };

  const resetForm = () => {
    setStep(1);
    setClientMode('existing');
    setClientId('');
    setProspectName('');
    setLine('auto');
    setFiles([]);
    setErrors([]);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    // Siempre permitir cerrar
    resetForm();
    onClose();
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newErrors: string[] = [];
    const validFiles: FileWithPreview[] = [];

    for (const file of acceptedFiles) {
      const validation = isValidFile(file);
      if (!validation.valid) {
        newErrors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      // Check if already added
      if (files.some(f => f.name === file.name && f.size === file.size)) {
        newErrors.push(`${file.name}: Ya está agregado`);
        continue;
      }

      // Check max files
      if (files.length + validFiles.length >= 8) {
        newErrors.push('Máximo 8 archivos permitidos');
        break;
      }

      const fileWithId = Object.assign(file, { 
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }) as FileWithPreview;
      
      validFiles.push(fileWithId);
    }

    setErrors(newErrors);
    setFiles(prev => [...prev, ...validFiles]);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const convertFilesToBase64 = async (): Promise<Array<{ name: string; type: string; size: number; base64: string }>> => {
    const results: Array<{ name: string; type: string; size: number; base64: string }> = [];
    
    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      results.push({
        name: file.name,
        type: file.type,
        size: file.size,
        base64
      });
    }
    
    return results;
  };

  const handleSubmit = async () => {
    if (files.length < 2) {
      setErrors(['Se requieren al menos 2 cotizaciones para comparar']);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);
    
    try {
      const filesWithBase64 = await convertFilesToBase64();
      await onSubmit({
        clientId: clientMode === 'existing' ? clientId : undefined,
        prospectName: clientMode === 'prospect' ? prospectName : undefined,
        line,
        files: filesWithBase64
      });
      // El onSubmit debería cerrar el wizard, pero por si acaso:
      resetForm();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Error al crear comparativo']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) {
      const hasClientOrProspect = clientMode === 'existing' ? !!clientId : !!prospectName.trim();
      const hasValidLine = aiEnabledLines.length > 0 && !!line;
      return hasClientOrProspect && hasValidLine;
    }
    if (step === 2) return files.length >= 2;
    return true;
  };

  const nextStep = () => {
    if (canProceed() && step < 3) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]" data-testid="new-comparison-wizard">
        <DialogHeader>
          <DialogTitle>Nuevo Comparativo</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s < step
                    ? 'bg-green-100 text-green-600'
                    : s === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {s < step ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    s < step ? 'bg-green-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

            {/* Step 1: Client & Line */}
            {step === 1 && (
              <div className="space-y-6 py-4">
                {/* Selector: Cliente existente o Prospecto */}
                <div className="space-y-3">
                  <Label>¿Para quién es el comparativo?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setClientMode('existing')}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        clientMode === 'existing'
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <User className={`h-5 w-5 ${clientMode === 'existing' ? 'text-primary' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className={`text-sm font-medium ${clientMode === 'existing' ? 'text-primary' : ''}`}>
                          Cliente existente
                        </p>
                        <p className="text-xs text-muted-foreground">Ya registrado en el sistema</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientMode('prospect')}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        clientMode === 'prospect'
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <UserPlus className={`h-5 w-5 ${clientMode === 'prospect' ? 'text-primary' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className={`text-sm font-medium ${clientMode === 'prospect' ? 'text-primary' : ''}`}>
                          Prospecto nuevo
                        </p>
                        <p className="text-xs text-muted-foreground">Cotización rápida</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Campo según el modo */}
                {clientMode === 'existing' ? (
                  <div className="space-y-2">
                    <Label>Seleccionar cliente *</Label>
                    <ClientSearchSelect
                      value={clientId}
                      onValueChange={setClientId}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Nombre del prospecto *</Label>
                    <Input
                      placeholder="Ej: Juan Pérez - Seguro Auto"
                      value={prospectName}
                      onChange={(e) => setProspectName(e.target.value)}
                      data-testid="prospect-name-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este nombre te ayudará a identificar el comparativo después
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Grupo de seguro *</Label>
                  {loadingLines ? (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargando grupos...</span>
                    </div>
                  ) : aiEnabledLines.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700">
                        No hay grupos configurados con IA. Contacta al administrador.
                      </p>
                    </div>
                  ) : (
                    <Select value={line} onValueChange={(v) => setLine(v as PolicyLine)}>
                      <SelectTrigger data-testid="line-select">
                        <SelectValue placeholder="Seleccionar grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {aiEnabledLines.map((aiLine) => (
                          <SelectItem key={aiLine.id} value={aiLine.slug}>
                            {aiLine.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Solo se muestran grupos con prompts de IA configurados
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: File Upload */}
            {step === 2 && (
              <div className="space-y-4 py-4">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input {...getInputProps()} data-testid="file-upload-input" />
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">
                    {isDragActive
                      ? 'Suelta los archivos aquí...'
                      : 'Arrastra cotizaciones o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF o DOCX, máximo 10MB por archivo (2-8 archivos)
                  </p>
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <Label>Archivos seleccionados ({files.length})</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                          data-testid={`file-item-${file.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium truncate max-w-[300px]">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)} • {getFileType(file.name)?.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            className="h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {errors.length > 0 && (
                  <div className="space-y-2">
                    {errors.map((error, i) => (
                      <p key={i} className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </p>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClose}
                      className="mt-2"
                    >
                      Cerrar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div className="space-y-4 py-4">
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Resumen del comparativo</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        {clientMode === 'existing' ? 'Cliente:' : 'Prospecto:'}
                      </span>
                      <p className="font-medium">
                        {clientMode === 'existing' ? 'Cliente seleccionado' : prospectName}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Grupo:</span>
                      <p className="font-medium">{getLineName(line)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Archivos:</span>
                      <p className="font-medium">{files.length} cotizaciones</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Archivos a analizar:</span>
                    <ul className="mt-1 text-sm space-y-1">
                      {files.map((file) => (
                        <li key={file.id} className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <Sparkles className="h-4 w-4 inline-block mr-1" />
                    La IA analizará las cotizaciones y extraerá automáticamente la información
                    para generar un cuadro comparativo.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={step === 1 ? handleClose : prevStep}
                disabled={isSubmitting}
              >
                {step === 1 ? 'Cancelar' : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </>
                )}
              </Button>

              {step < 3 ? (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  data-testid="wizard-next-btn"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  data-testid="wizard-submit-btn"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generar Comparativo
                </Button>
              )}
            </div>
      </DialogContent>
    </Dialog>
  );
}
