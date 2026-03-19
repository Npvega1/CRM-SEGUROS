'use client';

// =====================================================
// COMPONENTE: ClaimDocuments
// Grid de documentos con preview y upload
// =====================================================

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Upload,
  File,
  FileText,
  Image as ImageIcon,
  Table,
  Download,
  X,
  Loader2,
  Eye
} from 'lucide-react';
import {
  type ClaimDocument,
  formatClaimDateTime,
  formatFileSize,
  isImageFile,
  getFileTypeIcon
} from '@/lib/validations/claims';

interface ClaimDocumentsProps {
  documents: ClaimDocument[];
  claimId: string;
  tenantId: string;
  onUpload: (files: File[]) => Promise<void>;
  onGetSignedUrl: (document: ClaimDocument) => Promise<string | null>;
  isUploading?: boolean;
  uploadProgress?: Record<string, number>;
}

const FILE_ICONS: Record<string, typeof File> = {
  Image: ImageIcon,
  FileText: FileText,
  Table: Table,
  File: File
};

export function ClaimDocuments({
  documents,
  claimId,
  tenantId,
  onUpload,
  onGetSignedUrl,
  isUploading = false,
  uploadProgress = {}
}: ClaimDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ClaimDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onUpload(files);
    }
  }, [onUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUpload(files);
      // Reset input
      e.target.value = '';
    }
  }, [onUpload]);

  const handlePreview = useCallback(async (doc: ClaimDocument) => {
    setPreviewDoc(doc);
    setIsLoadingPreview(true);
    const url = await onGetSignedUrl(doc);
    setPreviewUrl(url);
    setIsLoadingPreview(false);
  }, [onGetSignedUrl]);

  const handleDownload = useCallback(async (doc: ClaimDocument) => {
    const url = await onGetSignedUrl(doc);
    if (url) {
      window.open(url, '_blank');
    }
  }, [onGetSignedUrl]);

  const getIconComponent = (fileType: string) => {
    const iconName = getFileTypeIcon(fileType);
    return FILE_ICONS[iconName] || File;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        data-testid="document-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Subiendo archivos...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Arrastra archivos aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground">
              Imágenes, PDF, Word, Excel (máx. 10MB cada uno)
            </p>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {progress}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Documents grid */}
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No hay documentos adjuntos
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const IconComponent = getIconComponent(doc.file_type);
            const isImage = isImageFile(doc.file_type);

            return (
              <div
                key={doc.id}
                className="group relative border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
                data-testid={`document-${doc.id}`}
              >
                {/* Preview area */}
                <div className="aspect-square bg-muted/30 flex items-center justify-center relative">
                  {isImage ? (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  ) : (
                    <IconComponent className="h-12 w-12 text-muted-foreground" />
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => handlePreview(doc)}
                      data-testid={`preview-doc-${doc.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => handleDownload(doc)}
                      data-testid={`download-doc-${doc.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatClaimDateTime(doc.uploaded_at).split(',')[0]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{previewDoc?.file_name}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : previewUrl ? (
              previewDoc && isImageFile(previewDoc.file_type) ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.file_name}
                  className="max-w-full max-h-[60vh] mx-auto rounded"
                />
              ) : previewDoc?.file_type.includes('pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[60vh] rounded border"
                  title={previewDoc.file_name}
                />
              ) : (
                <div className="text-center py-8">
                  <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Vista previa no disponible para este tipo de archivo
                  </p>
                  <Button onClick={() => previewDoc && handleDownload(previewDoc)}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar archivo
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Error al cargar el archivo
              </div>
            )}
          </div>

          {previewDoc && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <span>Subido por: {previewDoc.uploader_name || 'Desconocido'}</span>
              <span>{formatClaimDateTime(previewDoc.uploaded_at)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
