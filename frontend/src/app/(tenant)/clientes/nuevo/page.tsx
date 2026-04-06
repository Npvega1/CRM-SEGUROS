'use client';

// =====================================================
// PÁGINA: Nuevo Cliente
// /clientes/nuevo
// =====================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ClientForm } from '@/components/modules/clients/ClientForm';
import { ArrowLeft, Shield } from 'lucide-react';
import { useTenant } from '@/lib/context/TenantContext';
import { LoadingScreen } from '@/components/ui/spinner';
import { createClient } from '@/lib/supabase/client';

export default function NewClientPage() {
  const { isLoading: isLoadingTenant, tenantName } = useTenant();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setTenantId(user.app_metadata?.tenant_id || null);
          setAgentId(user.id);
        }
      } catch (err) {
        console.error('Error loading user:', err);
      } finally {
        setLoadingUser(false);
      }
    }
    loadUserData();
  }, []);

  if (isLoadingTenant || loadingUser) {
    return <LoadingScreen message="Cargando..." />;
  }

  if (!tenantId || !agentId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Error: No se pudo obtener la información del usuario.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/clientes">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{tenantName || 'CRM Seguros'}</h1>
                <p className="text-xs text-muted-foreground">Nuevo Cliente</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <ClientForm
          tenantId={tenantId}
          agentId={agentId}
        />
      </main>
    </div>
  );
}
