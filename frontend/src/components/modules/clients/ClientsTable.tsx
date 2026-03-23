'use client';

// =====================================================
// COMPONENTE: ClientsTable
// Tabla de clientes con paginación y búsqueda
// =====================================================

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type Client,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  DOC_TYPE_LABELS,
  type ClientSegment,
  type DocType
} from '@/lib/validations/clients';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye,
  Edit,
  FileText
} from 'lucide-react';

interface ClientsTableProps {
  clients: (Client & { policies_count?: number })[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onSegmentFilter: (segment: string | undefined) => void;
  searchQuery?: string;
  segmentFilter?: string;
  isLoading?: boolean;
}

export function ClientsTable({
  clients,
  total,
  page,
  pageSize,
  onPageChange,
  onSearch,
  onSegmentFilter,
  searchQuery = '',
  segmentFilter,
  isLoading = false
}: ClientsTableProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const totalPages = Math.ceil(total / pageSize);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localSearch);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch(localSearch);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, documento o email..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-10"
              data-testid="clients-search-input"
            />
          </div>
        </form>
        
        <Select
          value={segmentFilter || 'all'}
          onValueChange={(value) => onSegmentFilter(value === 'all' ? undefined : value)}
        >
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="clients-segment-filter">
            <SelectValue placeholder="Todos los segmentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los segmentos</SelectItem>
            {(Object.entries(SEGMENT_LABELS) as [ClientSegment, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">Segmento</TableHead>
              <TableHead className="hidden lg:table-cell">Pólizas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2">Cargando...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{client.full_name}</p>
                      <p className="text-sm text-muted-foreground md:hidden">
                        {client.email || 'Sin email'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        {DOC_TYPE_LABELS[client.doc_type as DocType]}:
                      </span>{' '}
                      {client.doc_number}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {client.email || '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge className={SEGMENT_COLORS[client.segment as ClientSegment]}>
                      {SEGMENT_LABELS[client.segment as ClientSegment]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="outline" className="gap-1">
                      <FileText className="w-3 h-3" />
                      {client.policies_count ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/clientes/${client.id}`}>
                        <Button variant="ghost" size="icon" data-testid={`view-client-${client.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link href={`/clientes/${client.id}/editar`}>
                        <Button variant="ghost" size="icon" data-testid={`edit-client-${client.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
