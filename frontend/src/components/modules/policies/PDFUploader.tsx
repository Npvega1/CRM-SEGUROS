'use client';

// =====================================================
// COMPONENTE: PDFUploader
// Drag and drop para subir documentos de póliza
// =====================================================

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { uploadPolicyDocument, getDocumentSignedUrl } from '@/app/(tenant)/polizas/actions';
import { 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  Loader2,
  X,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PDFUploaderProps {
  policyId: string;
  currentDocumentUrl?: string | null;
  onUploadComplete?: (url: string) => void;
}

export function PDFUploader({ 
  policyId, 
  currentDocumentUrl,
  onUploadComplete 
}: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setSuccess(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdf')) {
        setFile(droppedFile);
      } else {
        setError('Solo se permiten archivos PDF');
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(false);

    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFile(selectedFile);
      } else {
        setError('Solo se permiten archivos PDF');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    // Simular progreso
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadPolicyDocument(policyId, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        setSuccess(true);
        onUploadComplete?.(result.data);
      } else {
        setError(result.error.message);
      }
    } catch {
      clearInterval(progressInterval);
      setError('Error al subir el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDocument = async () => {
    setIsLoadingUrl(true);
    try {
      const result = await getDocumentSignedUrl(policyId);
      if (result.success) {
        window.open(result.data, '_blank');
      } else {
        setError(result.error.message);
      }
    } catch {
      setError('Error al obtener el documento');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const resetUploader = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
  };

  // Si ya hay documento subido exitosamente o hay uno existente
  if (success || (currentDocumentUrl && !file)) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Documento adjunto</p>
              <p className="text-sm text-muted-foreground">
                {file?.name || 'Documento de póliza'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDocument}
              disabled={isLoadingUrl}
            >
              {isLoadingUrl ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Ver</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetUploader}
            >
              <Upload className="w-4 h-4" />
              <span className="ml-2 hidden sm:inline">Cambiar</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
          error && 'border-red-300 bg-red-50'
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('pdf-input')?.click()}
      >
        <input
          id="pdf-input"
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-10 h-10 text-primary" />
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); resetUploader(); }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Arrastra un archivo PDF aquí o haz clic para seleccionar
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Máximo 10MB
            </p>
          </>
        )}
      </div>

      {/* Barra de progreso */}
      {isUploading && (
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Subiendo... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Botón de subir */}
      {file && !isUploading && (
        <Button onClick={handleUpload} className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          Subir Documento
        </Button>
      )}
    </div>
  );
}
