'use client';

// =====================================================
// PÁGINA: Lista de Clientes (OPTIMIZADA)
// /clientes
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientsTable } from '@/components/modules/clients/ClientsTable';
import { CSVImporter } from '@/components/modules/clients/CSVImporter';
import { listClients, getClientStats } from './actions';
import type { Client } from '@/lib/validations/clients';
import { 
  Plus, 
  Users, 
  Building2, 
  Crown,
  ArrowLeft,
  Shield
} from 'lucide-react';

export default function ClientsPage() {
  const { isLoading: isLoadingTenant, tenantName } = useTenant();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    bySegment: Record<string, number>;
    thisMonth: number;
  } | null>(null);

  // OPTIMIZACIÓN: Cargar datos en paralelo en un solo useEffect
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      
      // OPTIMIZACIÓN: Cargar clientes y stats EN PARALELO
      const [clientsResult, statsResult] = await Promise.all([
        listClients({
          page,
          pageSize,
          search: searchQuery || undefined,
          segment: segmentFilter
        }),
        getClientStats()
      ]);
      
      // Solo actualizar estado si el componente sigue montado
      if (!isMounted) return;
      
      if (clientsResult.success) {
        setClients(clientsResult.data.clients);
        setTotal(clientsResult.data.total);
      }
      
      if (statsResult.success) {
        setStats(statsResult.data);
      }
      
      setIsLoading(false);
    }

    if (!isLoadingTenant) {
      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [isLoadingTenant, page, pageSize, searchQuery, segmentFilter]);

  // OPTIMIZACIÓN: Debounce para el search
  const handleSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (query: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setSearchQuery(query);
        setPage(1);
      }, 300); // 300ms de debounce
    };
  }, []);

  const handleSegmentFilter = (segment: string | undefined) => {
    setSegmentFilter(segment);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleImportSuccess = () => {
    // Recargar datos después de importar
    setPage(1);
  };

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Gestión de Clientes</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <Users className="w-8 h-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Individuales</p>
                  <p className="text-2xl font-bold">{stats?.bySegment?.individual || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Empresas</p>
                  <p className="text-2xl font-bold">{stats?.bySegment?.empresa || 0}</p>
                </div>
                <Building2 className="w-8 h-8 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">VIP</p>
                  <p className="text-2xl font-bold">{stats?.bySegment?.vip || 0}</p>
                </div>
                <Crown className="w-8 h-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acciones y Tabla */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Clientes</CardTitle>
                <CardDescription>
                  Gestiona tu cartera de clientes
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <CSVImporter onSuccess={handleImportSuccess} />
                <Link href="/clientes/nuevo">
                  <Button data-testid="new-client-button">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Cliente
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ClientsTable
              clients={clients}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onSearch={handleSearch}
              onSegmentFilter={handleSegmentFilter}
              searchQuery={searchQuery}
              segmentFilter={segmentFilter}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
