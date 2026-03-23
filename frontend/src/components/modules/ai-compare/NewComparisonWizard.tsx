'use client';

// =====================================================
// COMPONENTE: NewComparisonWizard
// Wizard para crear un nuevo comparativo
// =====================================================

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ClientSearchSelect } from './ClientSearchSelect';
import { 
  isValidFile, 
  formatFileSize, 
  getFileType,
  ALLOWED_EXTENSIONS 
} from '@/lib/validations/comparisons';
import { POLICY_LINE_LABELS, type PolicyLine } from '@/lib/validations/policies';
import { 
  Upload, 
  X, 
  FileText, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react';

interface FileWithPreview extends File {
  id: string;
  base64?: string;
}

interface NewComparisonWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    clientId: string;
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
  const [clientId, setClientId] = useState<string>('');
  const [line, setLine] = useState<PolicyLine>('auto');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setStep(1);
    setClientId('');
    setLine('auto');
    setFiles([]);
    setErrors([]);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (!isProcessing && !isSubmitting) {
      resetForm();
      onClose();
    }
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
    try {
      const filesWithBase64 = await convertFilesToBase64();
      await onSubmit({
        clientId,
        line,
        files: filesWithBase64
      });
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Error al crear comparativo']);
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return !!clientId && !!line;
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
          <DialogTitle>
            {isProcessing ? 'Procesando con IA...' : 'Nuevo Comparativo'}
          </DialogTitle>
        </DialogHeader>

        {/* Processing State */}
        {isProcessing ? (
          <div className="py-12 text-center space-y-6">
            <div className="relative">
              <div className="h-24 w-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium">La IA está analizando las cotizaciones...</p>
              <p className="text-sm text-muted-foreground">
                Esto puede tomar unos segundos
              </p>
            </div>
            <div className="max-w-xs mx-auto">
              <Progress value={processingProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {processingProgress}% completado
              </p>
            </div>
          </div>
        ) : (
          <>
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
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <ClientSearchSelect
                    value={clientId}
                    onValueChange={setClientId}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ramo de seguro *</Label>
                  <Select value={line} onValueChange={(v) => setLine(v as PolicyLine)}>
                    <SelectTrigger data-testid="line-select">
                      <SelectValue placeholder="Seleccionar ramo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(POLICY_LINE_LABELS) as [PolicyLine, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
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
                  <div className="space-y-1">
                    {errors.map((error, i) => (
                      <p key={i} className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </p>
                    ))}
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
                      <span className="text-muted-foreground">Ramo:</span>
                      <p className="font-medium">{POLICY_LINE_LABELS[line]}</p>
                    </div>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
