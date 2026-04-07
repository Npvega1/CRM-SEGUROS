'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/context/TenantContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { LoadingScreen } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientsTable } from '@/components/modules/clients/ClientsTable';
import type { Client } from '@/lib/validations/clients';
import { createClient } from '@/lib/supabase/client';
import { 
  Plus, 
  Users, 
  Building2,
  ArrowLeft,
  Shield
} from 'lucide-react';

export default function ClientsPage() {
  const { isLoading: isLoadingTenant, tenantName, tenantId } = useTenant();
  const { isAdmin, canCreate } = usePermissions();
  
  const [clients, setClients] = useState<(Client & { policies_count?: number })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    persona_natural: number;
    persona_juridica: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (isLoadingTenant || !tenantId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const supabase = createClient();
        
        let query = (supabase as any)
          .from('clients')
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);
        
        if (searchQuery) {
          query = query.or(`full_name.ilike.%${searchQuery}%,doc_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
        }
        
        if (segmentFilter) {
          query = query.eq('segment', segmentFilter);
        }
        
        const { data: clientsData, count, error: clientsError } = await query;
        
        if (!isMounted) return;
        
        if (clientsError) {
          console.error('Error loading clients:', clientsError);
          setError(clientsError.message || 'Error al cargar clientes');
        } else if (clientsData) {
          const clientIds = clientsData.map((c: Client) => c.id);
          
          if (clientIds.length > 0) {
            const { data: policiesCount } = await (supabase as any)
              .from('policies')
              .select('client_id')
              .eq('tenant_id', tenantId)
              .in('client_id', clientIds);
            
            const countMap: Record<string, number> = {};
            if (policiesCount) {
              policiesCount.forEach((p: { client_id: string }) => {
                countMap[p.client_id] = (countMap[p.client_id] || 0) + 1;
              });
            }
            
            const clientsWithCount = clientsData.map((client: Client) => ({
              ...client,
              policies_count: countMap[client.id] || 0
            }));
            
            setClients(clientsWithCount);
          } else {
            setClients(clientsData as Client[]);
          }
          setTotal(count || 0);
        }
        
        // Cargar estadisticas con los segmentos correctos
        const { data: allClients, error: statsError } = await (supabase as any)
          .from('clients')
          .select('segment')
          .eq('tenant_id', tenantId);
        
        if (!statsError && allClients) {
          let naturalCount = 0;
          let juridicaCount = 0;
          
          (allClients as Array<{ segment: string }>).forEach(client => {
            if (client.segment === 'persona_natural') {
              naturalCount++;
            } else if (client.segment === 'persona_juridica') {
              juridicaCount++;
            }
          });
          
          setStats({
            total: allClients.length,
            persona_natural: naturalCount,
            persona_juridica: juridicaCount
          });
        }
        
      } catch (err) {
        if (!isMounted) return;
        console.error('Error:', err);
        setError('Error al cargar datos. Por favor, intenta de nuevo.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoadingTenant, tenantId, page, pageSize, searchQuery, segmentFilter]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleSegmentFilter = (segment: string | undefined) => {
    setSegmentFilter(segment);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  if (isLoadingTenant) {
    return <LoadingScreen message="Cargando..." />;
  }

  const showCreateButton = isAdmin || canCreate('clientes');

  return (
    <div className="min-h-screen bg-slate-50">
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
                <p className="text-xs text-muted-foreground">Gestion de Clientes</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="text-red-600 hover:text-red-800"
                >
                  Recargar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats - Solo 3 tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                  <p className="text-sm text-muted-foreground">Persona Natural</p>
                  <p className="text-2xl font-bold">{stats?.persona_natural || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Persona Juridica</p>
                  <p className="text-2xl font-bold">{stats?.persona_juridica || 0}</p>
                </div>
                <Building2 className="w-8 h-8 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

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
                {showCreateButton && (
                  <Link href="/clientes/nuevo">
                    <Button data-testid="new-client-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Cliente
                    </Button>
                  </Link>
                )}
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
