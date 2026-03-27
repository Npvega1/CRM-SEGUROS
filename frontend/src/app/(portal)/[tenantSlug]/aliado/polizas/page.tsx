'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, Download, Eye, ExternalLink, File } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { getBrowserClient } from '@/lib/supabase/client';
import { 
  getAlliedAgentByAuthUserId,
  getAlliedAgentPolicies 
} from '@/lib/services/allied-agents.service';
import type { AlliedAgentPolicy } from '@/types/allied-agents';

export default function AlliedPoliciesPage() {
  const [policies, setPolicies] = useState<AlliedAgentPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<AlliedAgentPolicy | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const alliedAgent = await getAlliedAgentByAuthUserId(user.id);
      if (!alliedAgent?.id) return;

      const data = await getAlliedAgentPolicies(alliedAgent.id);
      setPolicies(data);
    } catch (error) {
      toast.error('Error al cargar pólizas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-800">Activa</Badge>;
      case 'expired':
        return <Badge variant="secondary">Vencida</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{status || '-'}</Badge>;
    }
  };

  const handleViewDocument = (policy: AlliedAgentPolicy) => {
    setSelectedPolicy(policy);
    setShowDocumentModal(true);
  };

  const openDocumentInNewTab = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Pólizas</h1>
        <p className="text-muted-foreground mt-1">
          Pólizas de tus clientes vinculados
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p>Aún no tienes pólizas registradas</p>
              <p className="text-sm">Cuando tus clientes tengan pólizas, aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Póliza</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead>Ramo</TableHead>
                    <TableHead>Prima</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Documentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">
                        {policy.policy_number || '-'}
                      </TableCell>
                      <TableCell>
                        {policy.client?.full_name || '-'}
                      </TableCell>
                      <TableCell>
                        {policy.insurance_company?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {policy.insurance_line?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(policy.premium)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(policy.start_date)}</div>
                          <div className="text-muted-foreground">
                            al {formatDate(policy.end_date)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(policy.status)}
                      </TableCell>
                      <TableCell>
                        {policy.document_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDocument(policy)}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sin documentos</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para ver documento */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Documento de Póliza
            </DialogTitle>
          </DialogHeader>
          
          {selectedPolicy && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Póliza</p>
                <p className="font-semibold">{selectedPolicy.policy_number}</p>
                <p className="text-sm text-muted-foreground mt-2">Cliente</p>
                <p className="font-medium">{selectedPolicy.client?.full_name}</p>
              </div>

              {selectedPolicy.document_url && (
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => openDocumentInNewTab(selectedPolicy.document_url!)}
                    className="w-full gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Documento
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = selectedPolicy.document_url!;
                      link.download = `poliza-${selectedPolicy.policy_number}.pdf`;
                      link.click();
                    }}
                    className="w-full gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
