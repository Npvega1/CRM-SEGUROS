'use client';

import { useState } from 'react';
import { FileText, Upload, X, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

import {
  uploadAlliedAgentDocument,
  getDocumentSignedUrl,
  deleteAlliedAgentDocument,
} from '@/lib/services/allied-agents.service';
import { getBrowserClient } from '@/lib/supabase/client';
import { type AlliedAgent, DOCUMENT_TYPES, type DocumentType } from '@/types/allied-agents';

interface AlliedAgentDocumentsProps {
  agent: AlliedAgent;
  onUpdate: () => void;
}

export function AlliedAgentDocuments({ agent, onUpdate }: AlliedAgentDocumentsProps) {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DocumentType>('cedula');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const getDocumentPath = (type: DocumentType): string | null => {
    switch (type) {
      case 'cedula': return agent.document_cedula || null;
      case 'bank_certificate': return agent.document_bank_certificate || null;
      case 'rut': return agent.document_rut || null;
      case 'other': return agent.document_other || null;
      default: return null;
    }
  };

  const existingDocuments = DOCUMENT_TYPES.filter(dt => getDocumentPath(dt.value) !== null);
  const availableTypes = DOCUMENT_TYPES.filter(dt => getDocumentPath(dt.value) === null);

  const handleUpload = async () => {
    if (!selectedFile || !agent.id) return;

    setUploading(true);
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;

      if (!tenantId) throw new Error('No se encontró el tenant');

      await uploadAlliedAgentDocument(agent.id, tenantId, selectedType, selectedFile);
      toast.success('Documento subido exitosamente');
      setSelectedFile(null);
      onUpdate();
    } catch (error) {
      toast.error('Error al subir documento');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (type: DocumentType) => {
    const path = getDocumentPath(type);
    if (!path) return;

    setDownloading(type);
    try {
      const signedUrl = await getDocumentSignedUrl(path);
      window.open(signedUrl, '_blank');
    } catch (error) {
      toast.error('Error al descargar documento');
      console.error(error);
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (type: DocumentType) => {
    const path = getDocumentPath(type);
    if (!path || !agent.id) return;

    setDeleting(type);
    try {
      await deleteAlliedAgentDocument(agent.id, type, path);
      toast.success('Documento eliminado');
      onUpdate();
    } catch (error) {
      toast.error('Error al eliminar documento');
      console.error(error);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {existingDocuments.length > 0 ? (
          existingDocuments.map((doc) => {
            const path = getDocumentPath(doc.value);
            const fileName = path?.split('/').pop() || doc.label;

            return (
              <div key={doc.value} className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">{doc.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc.value)}
                    disabled={downloading === doc.value}
                  >
                    {downloading === doc.value ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.value)}
                    disabled={deleting === doc.value}
                  >
                    {deleting === doc.value ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay documentos adjuntos
          </p>
        )}
      </div>

      {availableTypes.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <p className="text-sm font-medium">Subir nuevo documento</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as DocumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Archivo</Label>
              <Input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="w-full">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Subir Documento
          </Button>
        </div>
      )}
    </div>
  );
}
