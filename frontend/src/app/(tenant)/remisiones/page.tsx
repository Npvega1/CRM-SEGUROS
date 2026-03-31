'use client';

// =====================================================
// PAGINA: Remisiones
// /remisiones
// Control de remisiones antes de pasar a Cartera
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  formatPremium,
  formatDate,
  POLICY_LINE_LABELS,
  type PolicyLine
} from '@/lib/validations/policies';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  Search,
  Eye,
  ClipboardCheck,
  Clock,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface RemisionWithPolicy {
  id: string;
  policy_id: string;
  numero_remision: string | null;
  estado: 'pendiente' | 'remisionada';
  fecha_remision: string | null;
  notas: string | null;
  created_at: string;
  policy: {
    id: string;
    policy_number: string;
    anexo: string | null;
    insurer: string;
    line: string;
    premium: number;
    start_date: string;
    end_date: string;
    status: string;
    clients: { full_name: string } | null;
    insurance_line: { id: string; name: string; slug: string } | null;
  };
}

export default function RemisionesPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();

  const [activeTab, setActiveTab] = useState<'pendiente' | 'remisionada'>('pendiente');
  const [remisiones, setRemisiones] = useState<RemisionWithPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pendientesCount, setPendientesCount] = useState(0);
  const [remisionadasCount, setRemisionadasCount] = useState(0);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [selectedRemision, setSelectedRemision] = useState<RemisionWithPolicy | null>(null);
  const [notasRemision, setNotasRemision] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRemisiones = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const supabase = getBrowserClient();

      let query = supabase
        .from('remisiones')
        .select(`
          *,
          policy:policies!inner(
            id,
            policy_number,
            anexo,
            insurer,
            line,
            premium,
            start_date,
            end_date,
            status,
            clients(full_name),
            insurance_line:insurance_lines(id, name, slug)
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('estado', activeTab)
        .order('created_at', { ascending: activeTab === 'pendiente' })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (searchQuery) {
        query = query.or(
          `policy.policy_number.ilike.%${searchQuery}%,numero_remision.ilike.%${searchQuery}%`,
        );
      }

      const { data, count, error } = await query;

      if (error) {
        console.error('Error loading remisiones:', error);

        // Fallback: buscar sin filtro de texto en join
        if (searchQuery) {
          const fallbackQuery = supabase
            .from('remisiones')
            .select(`
              *,
              policy:policies!inner(
                id,
                policy_number,
                anexo,
                insurer,
                line,
                premium,
                start_date,
                end_date,
                status,
                clients(full_name),
                insurance_line:insurance_lines(id, name, slug)
              )
            `, { count: 'exact' })
            .eq('tenant_id', tenantId)
            .eq('estado', activeTab)
            .order('created_at', { ascending: activeTab === 'pendiente' })
            .range((page - 1) * pageSize, page * pageSize - 1);

          const { data: fbData, count: fbCount } = await fallbackQuery;

          if (fbData) {
            const filtered = fbData.filter((r: RemisionWithPolicy) =>
              r.policy?.policy_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.numero_remision?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.policy?.clients?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setRemisiones(filtered as RemisionWithPolicy[]);
            setTotal(filtered.length);
          }
        }

        setIsLoading(false);
        return;
      }

      setRemisiones((data || []) as RemisionWithPolicy[]);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error loading remisiones:', error);
    }
    setIsLoading(false);
  }, [tenantId, activeTab, page, pageSize, searchQuery]);

  const loadCounts = useCallback(async () => {
    if (!tenantId) return;

    try {
      const supabase = getBrowserClient();

      const [pendientes, remisionadas] = await Promise.all([
        supabase
          .from('remisiones')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('estado', 'pendiente'),
        supabase
          .from('remisiones')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('estado', 'remisionada'),
      ]);

      setPendientesCount(pendientes.count || 0);
      setRemisionadasCount(remisionadas.count || 0);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!isLoadingTenant && tenantId) {
      loadRemisiones();
      loadCounts();
    }
  }, [isLoadingTenant, tenantId, loadRemisiones, loadCounts]);

  const handleOpenRemisionar = (remision: RemisionWithPolicy) => {
    setSelectedRemision(remision);
    setNotasRemision('');
    setShowDialog(true);
  };

  const handleRemisionar = async () => {
    if (!selectedRemision) return;

    setIsSubmitting(true);
    try {
      const supabase = getBrowserClient();

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Error: No se pudo obtener el usuario actual');
        return;
      }

      const { data, error } = await supabase.rpc('remisionar_poliza', {
        p_remision_id: selectedRemision.id,
        p_responsable_id: user.id,
        p_notas: notasRemision || null,
      });

      if (error) {
        console.error('Error remisionando:', error);
        toast.error('Error al remisionar: ' + error.message);
        return;
      }

      const result = data as { success: boolean; numero_remision?: string; error?: string };

      if (result && result.success) {
        toast.success(`Remisionada exitosamente: ${result.numero_remision}`);
        setShowDialog(false);
        setSelectedRemision(null);
        loadRemisiones();
        loadCounts();
      } else {
        toast.error(result?.error || 'Error al remisionar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error inesperado al remisionar');
    }
    setIsSubmitting(false);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (isLoadingTenant) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="remisiones-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Remisiones</h1>
          <p className="text-sm text-muted-foreground">{tenantName}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className={`cursor-pointer transition-all ${activeTab === 'pendiente' ? 'ring-2 ring-amber-500' : ''}`}
          onClick={() => { setActiveTab('pendiente'); setPage(1); }}
          data-testid="tab-pendientes"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes de Remisionar</p>
                <p className="text-3xl font-bold text-amber-600">{pendientesCount}</p>
              </div>
              <Clock className="w-10 h-10 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${activeTab === 'remisionada' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => { setActiveTab('remisionada'); setPage(1); }}
          data-testid="tab-remisionadas"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Remisionadas</p>
                <p className="text-3xl font-bold text-green-600">{remisionadasCount}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por poliza, remision o cliente..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          className="pl-10"
          data-testid="search-remisiones-input"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : remisiones.length === 0 ? (
            <div className="text-center text-muted-foreground p-12">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron remisiones {activeTab === 'pendiente' ? 'pendientes' : 'aprobadas'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {activeTab === 'remisionada' && <TableHead>Remision</TableHead>}
                  {activeTab === 'remisionada' && <TableHead>F. Remision</TableHead>}
                  <TableHead>Poliza</TableHead>
                  <TableHead>Anexo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Aseguradora</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead className="text-right">Prima</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remisiones.map((remision) => (
                  <TableRow key={remision.id}>
                    {activeTab === 'remisionada' && (
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-mono text-xs">
                          {remision.numero_remision}
                        </Badge>
                      </TableCell>
                    )}
                    {activeTab === 'remisionada' && (
                      <TableCell className="text-sm text-muted-foreground">
                        {remision.fecha_remision ? formatDate(remision.fecha_remision) : '-'}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{remision.policy?.policy_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {remision.policy?.anexo || '00'}
                      </Badge>
                    </TableCell>
                    <TableCell>{remision.policy?.clients?.full_name || 'N/A'}</TableCell>
                    <TableCell>{remision.policy?.insurer}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {remision.policy?.insurance_line?.name ||
                         POLICY_LINE_LABELS[remision.policy?.line as PolicyLine] ||
                         remision.policy?.line || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPremium(remision.policy?.premium || 0)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(remision.policy?.start_date)} - {formatDate(remision.policy?.end_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/polizas/${remision.policy_id}`}>
                          <Button variant="ghost" size="sm" data-testid={`ver-poliza-${remision.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        {activeTab === 'pendiente' && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenRemisionar(remision)}
                            className="bg-green-600 hover:bg-green-700"
                            data-testid={`remisionar-${remision.id}`}
                          >
                            <ClipboardCheck className="w-4 h-4 mr-1" />
                            Remisionar
                          </Button>
                        )}
                      </div>
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
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">Pagina {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Remision</DialogTitle>
            <DialogDescription>
              Vas a remisionar la poliza <strong>{selectedRemision?.policy?.policy_number}</strong> Anexo <strong>{selectedRemision?.policy?.anexo || '00'}</strong>.
              Esto generara un numero de remision y la poliza pasara a Cartera.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Policy summary */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{selectedRemision?.policy?.clients?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aseguradora:</span>
                <span className="font-medium">{selectedRemision?.policy?.insurer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prima:</span>
                <span className="font-medium">{formatPremium(selectedRemision?.policy?.premium || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vigencia:</span>
                <span className="font-medium">
                  {formatDate(selectedRemision?.policy?.start_date || '')} - {formatDate(selectedRemision?.policy?.end_date || '')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Textarea
                placeholder="Agregar observaciones sobre la remision..."
                value={notasRemision}
                onChange={(e) => setNotasRemision(e.target.value)}
                rows={3}
                data-testid="remision-notas-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleRemisionar}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
              data-testid="confirm-remisionar-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Confirmar Remision
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
