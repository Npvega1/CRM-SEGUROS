'use client';

import { useState, useEffect } from 'react';
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
  FileText,
  Loader2
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
  const [isSearching, setIsSearching] = useState(false);
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    if (localSearch === searchQuery) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(() => {
      onSearch(localSearch);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearch]);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      {/* Filtros y Busqueda */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, documento o email..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 pr-10"
            data-testid="clients-search-input"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        <Select value={segmentFilter || 'all'} onValueChange={(value) => onSegmentFilter(value === 'all' ? undefined : value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
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
            <TableRow className="text-xs">
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Documento</TableHead>
              <TableHead className="text-xs hidden md:table-cell">Email</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">Segmento</TableHead>
              <TableHead className="text-xs hidden lg:table-cell">Polizas</TableHead>
              <TableHead className="text-xs text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2">Cargando...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {localSearch ? `No se encontraron clientes para "${localSearch}"` : 'No se encontraron clientes'}
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="text-xs" data-testid={`client-row-${client.id}`}>
                  <TableCell className="py-2">
                    <div>
                      <p className="font-medium text-xs">{client.full_name}</p>
                      <p className="text-[11px] text-muted-foreground md:hidden">
                        {client.email || 'Sin email'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="text-xs">
                      <span className="text-muted-foreground">
                        {DOC_TYPE_LABELS[client.doc_type as DocType] || client.doc_type}:
                      </span>{' '}
                      {client.doc_number}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-xs hidden md:table-cell">
                    {client.email || '-'}
                  </TableCell>
                  <TableCell className="py-2 hidden sm:table-cell">
                    <Badge className={`text-[10px] ${SEGMENT_COLORS[client.segment as ClientSegment] || 'bg-gray-100 text-gray-800'}`}>
                      {SEGMENT_LABELS[client.segment as ClientSegment] || client.segment}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 hidden lg:table-cell">
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <FileText className="w-3 h-3" />
                      {client.policies_count ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link href={`/clientes/${client.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`view-client-${client.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Link href={`/clientes/${client.id}/editar`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`edit-client-${client.id}`}>
                          <Edit className="w-3.5 h-3.5" />
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

      {/* Paginacion */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)}
              disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Pagina {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
