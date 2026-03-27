'use client';

// =====================================================
// CONTEXT: PortalContext
// Contexto para el Portal del Cliente (M07)
// Login simplificado con número de documento (sin Supabase Auth)
// =====================================================

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useParams, useRouter } from 'next/navigation';
import type { 
  PortalClient, 
  TenantSettings, 
  PortalSummary,
  PortalContextData 
} from '@/lib/validations/portal';

// =====================================================
// TIPOS
// =====================================================

interface PortalContextValue extends PortalContextData {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  updateActivity: () => Promise<void>;
}

const defaultContextValue: PortalContextValue = {
  client: {
    client_id: '',
    client_name: '',
    client_email: '',
    tenant_id: '',
    tenant_name: '',
    tenant_slug: '',
    agent_id: null
  },
  settings: null,
  summary: null,
  isLoading: true,
  error: null,
  refresh: async () => {},
  signOut: async () => {},
  updateActivity: async () => {}
};

// =====================================================
// CONTEXT
// =====================================================

const PortalContext = createContext<PortalContextValue>(defaultContextValue);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug as string;

  const [client, setClient] = useState<PortalClient | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isLoadingRef = useRef(false);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Cargar datos del portal
  const loadPortalData = useCallback(async (forceRefresh = false) => {
    if (isLoadingRef.current && !forceRefresh) return;
    if (!tenantSlug) return;

    isLoadingRef.current = true;
    setError(null);

    try {
      // Verificar sesión en sessionStorage
      const storedClientId = sessionStorage.getItem('portal_client_id');
      const storedTenantSlug = sessionStorage.getItem('portal_tenant_slug');

      // Si no hay sesión o el tenant no coincide, no hay cliente autenticado
      if (!storedClientId || storedTenantSlug !== tenantSlug) {
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Obtener datos completos del cliente desde la base de datos
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, full_name, email, tenant_id, agent_id')
        .eq('id', storedClientId)
        .eq('is_active', true)
        .single();

      if (clientError || !clientData) {
        // Sesión inválida, limpiar
        sessionStorage.removeItem('portal_client_id');
        sessionStorage.removeItem('portal_client_name');
        sessionStorage.removeItem('portal_client_email');
        sessionStorage.removeItem('portal_tenant_slug');
        setError('Sesión expirada. Por favor ingresa de nuevo.');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Obtener nombre del tenant por separado
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', clientData.tenant_id)
        .single();

      const tenantInfo = tenantData as { name: string } | null;

      // Cargar settings del tenant y resumen en paralelo
      const [settingsResult, summaryResult, agentResult] = await Promise.all([
        supabase
          .from('tenant_settings')
          .select('*')
          .eq('tenant_id', clientData.tenant_id)
          .maybeSingle(),
        supabase
          .rpc('get_portal_summary', {
            p_tenant_id: clientData.tenant_id,
            p_client_id: clientData.id
          }),
        clientData.agent_id 
          ? supabase
              .from('users')
              .select('full_name')
              .eq('id', clientData.agent_id)
              .maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      setClient({
        client_id: clientData.id,
        client_name: clientData.full_name,
        client_email: clientData.email || '',
        tenant_id: clientData.tenant_id,
        tenant_name: tenantInfo?.name || '',
        tenant_slug: tenantSlug,
        agent_id: clientData.agent_id,
        agent_name: agentResult.data?.full_name || undefined
      });

      if (settingsResult.data) {
        setSettings(settingsResult.data as TenantSettings);
      }

      const summaryArray = summaryResult.data as { active_policies_count: number; next_renewal: string | null; active_claims_count: number; pending_invoices_count: number; unread_messages_count: number }[] | null;
      if (summaryArray && summaryArray.length > 0) {
        setSummary(summaryArray[0] as PortalSummary);
      }

    } catch (e) {
      console.error('Error loading portal data:', e);
      setError('Error al cargar datos del portal');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [supabase, tenantSlug]);

  // Cerrar sesión
  const signOut = useCallback(async () => {
    try {
      // Limpiar sessionStorage
      sessionStorage.removeItem('portal_client_id');
      sessionStorage.removeItem('portal_client_name');
      sessionStorage.removeItem('portal_client_email');
      sessionStorage.removeItem('portal_tenant_slug');
      
      setClient(null);
      setSummary(null);
      router.push(`/${tenantSlug}/login`);
    } catch (e) {
      console.error('Error signing out:', e);
    }
  }, [router, tenantSlug]);

  // Actualizar actividad (placeholder para compatibilidad)
  const updateActivity = useCallback(async () => {
    // No se necesita para login con documento
  }, []);

  // Cargar datos al montar
  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Escuchar cambios en sessionStorage (por si se abre otra pestaña)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'portal_client_id') {
        if (!e.newValue) {
          // Se cerró sesión en otra pestaña
          setClient(null);
          setSummary(null);
        } else {
          // Se inició sesión en otra pestaña
          loadPortalData(true);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadPortalData]);

  const value: PortalContextValue = useMemo(() => ({
    client: client || defaultContextValue.client,
    settings,
    summary,
    isLoading,
    error,
    refresh: () => loadPortalData(true),
    signOut,
    updateActivity
  }), [client, settings, summary, isLoading, error, loadPortalData, signOut, updateActivity]);

  return (
    <PortalContext.Provider value={value}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}

// Hook para verificar si el cliente está autenticado en el portal
export function useIsPortalAuthenticated() {
  const { client, isLoading } = usePortal();
  return !isLoading && !!client.client_id;
}
