'use client';

// =====================================================
// COMPONENTE: PDFUploader
// Drag and drop para subir documentos de póliza
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';

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
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Debug: mostrar estado del tenant
  console.log('PDFUploader - tenantId:', tenantId, 'tenantLoading:', tenantLoading);

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
    if (!file) {
      setError('No hay archivo seleccionado');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const supabase = getBrowserClient();
      
      // Obtener tenant_id directamente del JWT para asegurar consistencia
      const { data: { user } } = await supabase.auth.getUser();
      const jwtTenantId = user?.app_metadata?.tenant_id;
      
      console.log('PDFUploader - JWT tenant_id:', jwtTenantId);
      console.log('PDFUploader - Context tenantId:', tenantId);
      
      // Usar el tenant_id del JWT (más confiable)
      const effectiveTenantId = jwtTenantId || tenantId;
      
      if (!effectiveTenantId) {
        clearInterval(progressInterval);
        setError('No se pudo obtener el tenant_id. Recarga la página.');
        setIsUploading(false);
        return;
      }
      
      // Generar path único usando el tenant_id del JWT
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${effectiveTenantId}/policies/${policyId}/${timestamp}_${safeName}`;

      console.log('PDFUploader - Uploading to path:', path);

      // Subir a storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true
        });

      clearInterval(progressInterval);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(`Error al subir: ${uploadError.message}`);
        setIsUploading(false);
        return;
      }

      console.log('Upload successful:', uploadData);
      setUploadProgress(100);

      // Actualizar póliza con el path del documento usando REST API directo
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/policies?id=eq.${policyId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ document_url: path })
        }
      );

      const updateError = !updateResponse.ok ? { message: 'Failed to update policy' } : null;

      if (updateError) {
        console.error('Error updating policy:', updateError);
        setError('Archivo subido pero no se pudo actualizar la póliza');
      } else {
        console.log('Policy updated with document_url:', path);
        setSuccess(true);
        onUploadComplete?.(path);
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Upload exception:', err);
      setError('Error inesperado al subir el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDocument = async () => {
    if (!tenantId) return;
    
    setIsLoadingUrl(true);
    try {
      const supabase = getBrowserClient();
      
      // Obtener la póliza para ver el document_url
      const { data: policy } = await supabase
        .from('policies')
        .select('document_url')
        .eq('id', policyId)
        .eq('tenant_id', tenantId)
        .single();
      
      const policyData = policy as { document_url?: string } | null;
      if (policyData?.document_url) {
        // Si es una URL completa, abrir directamente
        if (policyData.document_url.startsWith('http')) {
          window.open(policyData.document_url, '_blank');
        } else {
          // Si es un path, obtener signed URL
          const { data } = await supabase.storage
            .from('policy-documents')
            .createSignedUrl(policyData.document_url, 3600);
          
          if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
          }
        }
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

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {file && !isUploading && (
        <Button 
          onClick={handleUpload} 
          className="w-full" 
          disabled={!tenantId || tenantLoading}
          data-testid="upload-document-btn"
        >
          {tenantLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cargando...
            </>
          ) : !tenantId ? (
            'Sin sesión'
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Subir Documento
            </>
          )}
        </Button>
      )}
    </div>
  );
}
