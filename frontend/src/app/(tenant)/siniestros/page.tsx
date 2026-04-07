'use client';

// =====================================================
// PÁGINA: Lista de Siniestros
// /siniestros
// Usa Supabase Client directo (evita API Routes)
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  type ClaimWithRelations,
  type ClaimStatus,
  type OpenClaimInput,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  POLICY_LINE_LABELS,
  formatClaimAmount,
  formatClaimDate,
  OpenClaimInputSchema
} from '@/lib/validations/claims';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowLeft,
  FileWarning,
  CheckCircle2,
  Clock,
  Upload,
  X,
  FileText,
  Loader2
} from 'lucide-react';

interface ClaimStats {
  total: number;
  byStatus: Record<string, number>;
  totalClaimed: number;
  totalApproved: number;
}

interface PolicyOption {
  id: string;
  policy_number: string;
  insurer: string;
  line: string;
  client_id: string;
  client_name: string;
}

interface PendingFile {
  file: File;
  name: string;
}

// Formatear número con separadores de miles (estilo colombiano)
function formatThousands(value: string): string {
  // Eliminar todo excepto dígitos
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  // Formatear con puntos de miles
  return Number(digits).toLocaleString('es-CO');
}

// Extraer el número limpio (sin separadores) de un string formateado
function parseCleanNumber(formatted: string): string {
  return formatted.replace(/\./g, '').replace(/,/g, '');
}

export default function ClaimsPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId, userId } = useTenant();

  const [claims, setClaims] = useState<ClaimWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [lineFilter, setLineFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ClaimStats | null>(null);

  // Modal de nuevo siniestro
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyOption | null>(null);
  const [newClaimData, setNewClaimData] = useState({
    incident_date: '',
    claimed_amount: '',
    description: ''
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadClaims = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const supabase = getBrowserClient();
      
      let query = supabase
        .from('claims')
        .select(`
          *,
          clients!inner(id, full_name, email, phone),
          policies!inner(id, policy_number, insurer, line),
          users(id, full_name)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      if (searchQuery) {
        query = query.or(`description.ilike.%${searchQuery}%,policies.policy_number.ilike.%${searchQuery}%`);
      }
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (lineFilter && lineFilter !== 'all') {
        query = query.eq('policies.line', lineFilter);
      }
      
      const { data, count, error } = await query;
      
      if (error) {
        console.error('Error loading claims:', error);
      } else {
        const mappedClaims = (data || []).map((c: Record<string, unknown>) => ({
          ...c,
          client: c.clients as { id: string; full_name: string; email: string | null; phone: string | null },
          policy: c.policies as { id: string; policy_number: string; insurer: string; line: string },
          agent: c.users as { id: string; full_name: string } | null
        })) as ClaimWithRelations[];
        setClaims(mappedClaims);
        setTotal(count || 0);
      }
    } catch (error) {
      console.error('Error loading claims:', error);
    }
    setIsLoading(false);
  }, [tenantId, page, pageSize, searchQuery, statusFilter, lineFilter]);

  const loadStats = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const supabase = getBrowserClient();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allClaims } = await (supabase as any)
        .from('claims')
        .select('status, claimed_amount, approved_amount')
        .eq('tenant_id', tenantId);
      
      if (allClaims) {
        type ClaimStats = { status: string; claimed_amount: number; approved_amount: number };
        const claimsTyped = allClaims as ClaimStats[];
        
        const byStatus: Record<string, number> = {};
        let totalClaimed = 0;
        let totalApproved = 0;
        
        claimsTyped.forEach(c => {
          byStatus[c.status] = (byStatus[c.status] || 0) + 1;
          totalClaimed += c.claimed_amount || 0;
          totalApproved += c.approved_amount || 0;
        });
        
        setStats({
          total: claimsTyped.length,
          byStatus,
          totalClaimed,
          totalApproved
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [tenantId]);

  const loadActivePolicies = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const supabase = getBrowserClient();
      
      const { data } = await supabase
        .from('policies')
        .select(`
          id, policy_number, insurer, line, client_id,
          clients!inner(full_name)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'activa')
        .order('policy_number');
      
      if (data) {
        const mapped = data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          policy_number: p.policy_number as string,
          insurer: p.insurer as string,
          line: p.line as string,
          client_id: p.client_id as string,
          client_name: (p.clients as { full_name: string }).full_name
        }));
        setPolicies(mapped);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadClaims();
      loadStats();
    }
  }, [isLoadingTenant, tenantId, loadClaims, loadStats]);

  useEffect(() => {
    if (showNewClaimModal && tenantId) {
      loadActivePolicies();
    }
  }, [showNewClaimModal, tenantId, loadActivePolicies]);

  // Manejar selección de archivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => ({ file: f, name: f.name }));
      setPendingFiles(prev => [...prev, ...newFiles]);
      e.target.value = '';
    }
  };

  // Eliminar archivo pendiente
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateClaim = async () => {
    if (!selectedPolicy || !tenantId || !userId) return;
    
    setFormError(null);
    setIsSubmitting(true);
    
    try {
      const cleanAmount = parseCleanNumber(newClaimData.claimed_amount);

      const input: OpenClaimInput = {
        policy_id: selectedPolicy.id,
        client_id: selectedPolicy.client_id,
        incident_date: newClaimData.incident_date,
        claimed_amount: parseFloat(cleanAmount) || 0,
        description: newClaimData.description
      };
      
      const validation = OpenClaimInputSchema.safeParse(input);
      if (!validation.success) {
        const zodError = validation.error as { errors?: Array<{ message?: string }> };
        setFormError(zodError.errors?.[0]?.message || 'Datos inválidos');
        setIsSubmitting(false);
        return;
      }
      
      const supabase = getBrowserClient();
      
      // Crear el siniestro
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newClaim, error } = await (supabase as any)
        .from('claims')
        .insert({
          tenant_id: tenantId,
          policy_id: input.policy_id,
          client_id: input.client_id,
          agent_id: userId,
          status: 'reported',
          incident_date: input.incident_date,
          claimed_amount: input.claimed_amount,
          description: input.description
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating claim:', error);
        setFormError(error.message);
        setIsSubmitting(false);
        return;
      }
      
      // Insertar historial inicial
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('claims_history')
        .insert({
          claim_id: newClaim.id,
          changed_by: userId,
          old_status: null,
          new_status: 'reported',
          comment: 'Siniestro reportado',
          is_internal: false
        });

      // Subir documentos adjuntos si hay
      if (pendingFiles.length > 0) {
        for (const pf of pendingFiles) {
          const fileExt = pf.file.name.split('.').pop() || 'pdf';
          const filePath = `${tenantId}/${newClaim.id}/${Date.now()}_${pf.file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('claim-documents')
            .upload(filePath, pf.file);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            continue;
          }

          // Registrar en la tabla claim_documents
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('claim_documents')
            .insert({
              claim_id: newClaim.id,
              tenant_id: tenantId,
              uploader_id: userId,
              file_name: pf.file.name,
              file_url: filePath,
              file_type: fileExt,
              file_size: pf.file.size
            });
        }
      }
      
      // Limpiar y cerrar modal
      setShowNewClaimModal(false);
      setSelectedPolicy(null);
      setNewClaimData({ incident_date: '', claimed_amount: '', description: '' });
      setPendingFiles([]);
      
      // Recargar datos
      loadClaims();
      loadStats();
      
    } catch (error) {
      console.error('Error creating claim:', error);
      setFormError('Error al crear el siniestro');
    }
    
    setIsSubmitting(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="back-to-dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileWarning className="h-6 w-6 text-primary" />
              Siniestros
            </h1>
            <p className="text-muted-foreground">{tenantName}</p>
          </div>
        </div>
        <Button onClick={() => setShowNewClaimModal(true)} data-testid="new-claim-btn">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Siniestro
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Siniestros</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-yellow-500" />
                En Proceso
              </CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {(stats.byStatus['reported'] || 0) + (stats.byStatus['investigating'] || 0) + (stats.byStatus['processing'] || 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Monto Reclamado</CardDescription>
              <CardTitle className="text-2xl">{formatClaimAmount(stats.totalClaimed)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Monto Aprobado
              </CardDescription>
              <CardTitle className="text-2xl text-green-600">{formatClaimAmount(stats.totalApproved)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descripción o número de póliza..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-claims-input"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-[180px]" data-testid="status-filter">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(CLAIM_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lineFilter || 'all'} onValueChange={(v) => setLineFilter(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-[180px]" data-testid="line-filter">
                <SelectValue placeholder="Ramo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los ramos</SelectItem>
                {Object.entries(POLICY_LINE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : claims.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileWarning className="h-12 w-12 mb-4" />
              <p>No se encontraron siniestros</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Póliza</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Monto Reclamado</TableHead>
                  <TableHead>Monto Aprobado</TableHead>
                  <TableHead>Fecha Incidente</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id} data-testid={`claim-row-${claim.id}`}>
                    <TableCell className="font-medium">{claim.policy?.policy_number || 'N/A'}</TableCell>
                    <TableCell>{claim.client?.full_name || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {POLICY_LINE_LABELS[claim.policy?.line || ''] || claim.policy?.line || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={CLAIM_STATUS_COLORS[claim.status as ClaimStatus]}>
                        {CLAIM_STATUS_LABELS[claim.status as ClaimStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatClaimAmount(claim.claimed_amount)}</TableCell>
                    <TableCell>
                      {claim.approved_amount != null ? formatClaimAmount(claim.approved_amount || 0) : '-'}
                    </TableCell>
                    <TableCell>{formatClaimDate(claim.incident_date)}</TableCell>
                    <TableCell>{claim.agent?.full_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/siniestros/${claim.id}`}>
                        <Button variant="ghost" size="icon" data-testid={`view-claim-${claim.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Modal Nuevo Siniestro */}
      <Dialog open={showNewClaimModal} onOpenChange={setShowNewClaimModal}>
        <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto top-[55%]">
          <DialogHeader>
            <DialogTitle>Nuevo Siniestro</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {/* Selector de póliza */}
            <div className="space-y-1">
              <Label htmlFor="policy">Póliza Activa *</Label>
              <Select
                value={selectedPolicy?.id || ''}
                onValueChange={(v) => {
                  const policy = policies.find(p => p.id === v);
                  setSelectedPolicy(policy || null);
                }}
              >
                <SelectTrigger id="policy" data-testid="select-policy">
                  <SelectValue placeholder="Seleccionar póliza..." />
                </SelectTrigger>
                <SelectContent>
                  {policies.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.policy_number} - {p.client_name} ({p.insurer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPolicy && (
                <p className="text-xs text-muted-foreground">
                  Cliente: {selectedPolicy.client_name} | Ramo: {POLICY_LINE_LABELS[selectedPolicy.line] || selectedPolicy.line}
                </p>
              )}
            </div>

            {/* Fecha y Monto en una fila */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="incident_date">Fecha Incidente *</Label>
                <Input
                  id="incident_date"
                  type="date"
                  value={newClaimData.incident_date}
                  onChange={(e) => setNewClaimData(prev => ({ ...prev, incident_date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  data-testid="incident-date-input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="claimed_amount">Monto Reclamado *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="claimed_amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    className="pl-7"
                    value={newClaimData.claimed_amount}
                    onChange={(e) => {
                      const formatted = formatThousands(e.target.value);
                      setNewClaimData(prev => ({ ...prev, claimed_amount: formatted }));
                    }}
                    data-testid="claimed-amount-input"
                  />
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1">
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                placeholder="Describe lo ocurrido..."
                rows={2}
                value={newClaimData.description}
                onChange={(e) => setNewClaimData(prev => ({ ...prev, description: e.target.value }))}
                data-testid="description-input"
              />
            </div>

            {/* Documentos adjuntos */}
            <div className="space-y-1">
              <Label>Documentos Adjuntos</Label>
              <div
                className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">
                  Haz clic para seleccionar archivos
                </p>
              </div>

              {pendingFiles.length > 0 && (
                <div className="space-y-1 mt-1">
                  {pendingFiles.map((pf, index) => (
                    <div key={index} className="flex items-center justify-between p-1.5 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate">{pf.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => removePendingFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded text-xs">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowNewClaimModal(false);
                setSelectedPolicy(null);
                setNewClaimData({ incident_date: '', claimed_amount: '', description: '' });
                setPendingFiles([]);
                setFormError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateClaim}
              disabled={isSubmitting || !selectedPolicy || !newClaimData.incident_date || !newClaimData.description}
              data-testid="submit-claim-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : 'Crear Siniestro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
