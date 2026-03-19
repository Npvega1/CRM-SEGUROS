'use client';

// =====================================================
// COMPONENTE: CSVImporter
// Importador de clientes desde CSV
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  Download,
  Loader2,
  X
} from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { getBrowserClient } from '@/lib/supabase/client';

interface CSVRowError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

interface CSVImportResult {
  success: number;
  failed: number;
  errors: CSVRowError[];
}

interface CSVImporterProps {
  onSuccess?: () => void;
}

export function CSVImporter({ onSuccess }: CSVImporterProps) {
  const { tenantId, userId } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Array<Record<string, string>>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (text: string): Array<Record<string, string>> => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setResult(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      setFile(droppedFile);
      const text = await droppedFile.text();
      const data = parseCSV(text);
      setPreviewData(data.slice(0, 5));
    } else {
      setError('Por favor, sube un archivo CSV válido');
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);

    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const text = await selectedFile.text();
      const data = parseCSV(text);
      setPreviewData(data.slice(0, 5));
    }
  };

  const handleImport = async () => {
    if (!file || !tenantId) return;

    setIsImporting(true);
    setError(null);

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      const supabase = getBrowserClient();
      const errors: CSVRowError[] = [];
      let successCount = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const clientData = {
          tenant_id: tenantId,
          full_name: row.full_name || row.nombre || '',
          doc_type: row.doc_type || row.tipo_documento || 'cedula',
          doc_number: row.doc_number || row.documento || '',
          email: row.email || row.correo || null,
          phone: row.phone || row.telefono || null,
          segment: row.segment || row.segmento || 'individual',
          agent_id: userId,
          tags: row.tags ? row.tags.split(';').map((t: string) => t.trim()) : [],
          metadata: {}
        };

        // Validar campos requeridos
        if (!clientData.full_name) {
          errors.push({ row: i + 2, field: 'full_name', message: 'Nombre requerido' });
          continue;
        }
        if (!clientData.doc_number) {
          errors.push({ row: i + 2, field: 'doc_number', message: 'Documento requerido' });
          continue;
        }

        const { error: insertError } = await supabase
          .from('clients')
          .insert(clientData);

        if (insertError) {
          errors.push({ 
            row: i + 2, 
            field: 'insert', 
            message: insertError.code === '23505' ? 'Documento duplicado' : insertError.message,
            value: clientData.doc_number
          });
        } else {
          successCount++;
        }
      }

      setResult({
        success: successCount,
        failed: errors.length,
        errors
      });

      if (successCount > 0) {
        onSuccess?.();
      }
    } catch {
      setError('Error al procesar el archivo');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setPreviewData([]);
    setResult(null);
    setError(null);
  };

  const downloadTemplate = () => {
    const csvContent = 'full_name,doc_type,doc_number,email,phone,segment,tags\n' +
      'Juan Pérez,cedula,12345678,juan@email.com,3001234567,individual,cliente_nuevo\n' +
      'Empresa ABC,nit,900123456-1,contacto@abc.com,6011234567,empresa,corporativo';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="import-csv-button">
          <Upload className="w-4 h-4 mr-2" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Clientes desde CSV</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con los datos de los clientes a importar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="link" onClick={downloadTemplate} className="p-0">
            <Download className="w-4 h-4 mr-2" />
            Descargar plantilla CSV
          </Button>

          {!result && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {previewData.length} filas detectadas
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => { setFile(null); setPreviewData([]); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">
                    Arrastra un archivo CSV aquí o
                  </p>
                  <label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button variant="link" className="mt-2" asChild>
                      <span>selecciona un archivo</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          )}

          {previewData.length > 0 && !result && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Vista previa (primeras 5 filas)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Segmento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {row.full_name || row.nombre || '-'}
                          </TableCell>
                          <TableCell>
                            {row.doc_number || row.documento || '-'}
                          </TableCell>
                          <TableCell>
                            {row.email || row.correo || '-'}
                          </TableCell>
                          <TableCell>
                            {row.segment || row.segmento || 'individual'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-medium">{result.success} importados</span>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium">{result.failed} errores</span>
                    </div>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Errores encontrados:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {result.errors.slice(0, 10).map((err: CSVRowError, i: number) => (
                        <div key={i} className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                          Fila {err.row}: {err.message}
                          {err.value && ` (valor: "${err.value}")`}
                        </div>
                      ))}
                      {result.errors.length > 10 && (
                        <p className="text-sm text-muted-foreground">
                          ... y {result.errors.length - 10} errores más
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!result && (
              <Button 
                onClick={handleImport} 
                disabled={!file || isImporting || !tenantId}
                data-testid="confirm-import-button"
              >
                {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Importar {previewData.length > 0 && `(${previewData.length} filas)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
