'use client';

// =====================================================
// CONTEXT: PortalContext
// Contexto para el Portal del Cliente (M07)
// Maneja sesión, cliente, y configuración del tenant
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
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Obtener sesión actual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      const userEmail = session.user.email;
      if (!userEmail) {
        setError('Email no disponible');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Obtener datos del cliente por email y tenant slug
      const { data: clientData, error: clientError } = await supabase
        .rpc('get_portal_client_by_email', {
          p_tenant_slug: tenantSlug,
          p_email: userEmail
        });

      if (clientError) {
        console.error('Error fetching client:', clientError);
        setError('No se pudo verificar tu cuenta');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      const clientArray = clientData as { client_id: string; client_name: string; tenant_id: string; tenant_name: string; agent_id: string | null }[] | null;

      if (!clientArray || clientArray.length === 0) {
        setError('No tienes acceso a este portal. Verifica que tu email esté registrado.');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      const clientInfo = clientArray[0];
      
      // Cargar settings del tenant y resumen en paralelo
      const [settingsResult, summaryResult, agentResult] = await Promise.all([
        supabase
          .from('tenant_settings')
          .select('*')
          .eq('tenant_id', clientInfo.tenant_id)
          .maybeSingle(),
        supabase
          .rpc('get_portal_summary', {
            p_tenant_id: clientInfo.tenant_id,
            p_client_id: clientInfo.client_id
          }),
        clientInfo.agent_id 
          ? supabase
              .from('users')
              .select('full_name')
              .eq('id', clientInfo.agent_id)
              .maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      // Registrar sesión del portal
      await supabase.rpc('register_portal_session', {
        p_tenant_id: clientInfo.tenant_id,
        p_client_id: clientInfo.client_id,
        p_auth_user_id: session.user.id,
        p_device_info: {
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
          platform: typeof window !== 'undefined' ? window.navigator.platform : ''
        }
      });

      setClient({
        client_id: clientInfo.client_id,
        client_name: clientInfo.client_name,
        client_email: userEmail,
        tenant_id: clientInfo.tenant_id,
        tenant_name: clientInfo.tenant_name,
        tenant_slug: tenantSlug,
        agent_id: clientInfo.agent_id,
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
      await supabase.auth.signOut();
      setClient(null);
      setSummary(null);
      router.push(`/${tenantSlug}/login`);
    } catch (e) {
      console.error('Error signing out:', e);
    }
  }, [supabase, router, tenantSlug]);

  // Actualizar actividad
  const updateActivity = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await supabase.rpc('update_portal_session_activity', {
        p_auth_user_id: session.user.id
      });
    }
  }, [supabase]);

  // Cargar datos al montar
  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Actualizar actividad periódicamente
  useEffect(() => {
    if (client) {
      // Actualizar cada 2 minutos
      activityTimeoutRef.current = setInterval(() => {
        updateActivity();
      }, 2 * 60 * 1000);

      return () => {
        if (activityTimeoutRef.current) {
          clearInterval(activityTimeoutRef.current);
        }
      };
    }
  }, [client, updateActivity]);

  // Escuchar cambios de autenticación
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setClient(null);
        setSummary(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN') {
        loadPortalData(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, loadPortalData]);

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
