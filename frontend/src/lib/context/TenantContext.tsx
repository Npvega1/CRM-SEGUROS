'use client';

// =====================================================
// CONTEXT: TenantContext con Cache Optimizado
// Evita re-fetch en cada navegación
// =====================================================

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/database-types';

// =====================================================
// TIPOS
// =====================================================

export type Role = 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';

interface TenantContextData {
  // Usuario
  userId: string;
  userEmail: string;
  userFullName: string;
  role: Role;
  
  // Tenant
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  
  // Agente asignado (puede ser diferente al userId)
  agentId: string;
}

interface TenantContextValue extends Partial<TenantContextData> {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultContextValue: TenantContextValue = {
  userId: '',
  userEmail: '',
  userFullName: '',
  role: 'readonly',
  tenantId: '',
  tenantName: '',
  tenantSlug: '',
  agentId: '',
  isLoading: true,
  error: null,
  refresh: async () => {},
  signOut: async () => {},
};

// =====================================================
// CACHE - Evita re-fetch en navegación
// =====================================================

interface CachedContext {
  data: TenantContextData | null;
  timestamp: number;
  userId: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
let contextCache: CachedContext | null = null;

function getCachedContext(userId: string): TenantContextData | null {
  if (!contextCache) return null;
  if (contextCache.userId !== userId) return null;
  if (Date.now() - contextCache.timestamp > CACHE_DURATION) return null;
  return contextCache.data;
}

function setCachedContext(userId: string, data: TenantContextData | null) {
  contextCache = {
    data,
    timestamp: Date.now(),
    userId
  };
}

function clearCache() {
  contextCache = null;
}

// =====================================================
// CONTEXT
// =====================================================

const TenantContext = createContext<TenantContextValue>(defaultContextValue);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<TenantContextData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);

  const supabase = useMemo(() => createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const loadTenantContext = useCallback(async (forceRefresh = false) => {
    // Evitar cargas simultáneas
    if (isLoadingRef.current && !forceRefresh) return;
    isLoadingRef.current = true;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setContext(null);
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      if (!session?.user) {
        setContext(null);
        setIsLoading(false);
        isLoadingRef.current = false;
        clearCache();
        return;
      }

      const user = session.user;

      // Verificar cache (solo si no es refresh forzado)
      if (!forceRefresh) {
        const cached = getCachedContext(user.id);
        if (cached) {
          setContext(cached);
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        }
      }

      // Obtener datos del JWT
      const appMetadata = user.app_metadata || {};
      const tenantId = appMetadata.tenant_id as string | undefined;
      const role = (appMetadata.role as Role) || 'readonly';
      const agentId = (appMetadata.agent_id as string) || user.id;

      // Valores por defecto
      let userFullName = user.user_metadata?.full_name || '';
      let userEmail = user.email || '';
      let tenantName = '';
      let tenantSlug = '';
      let finalRole = role;

      // Cargar datos adicionales solo si hay tenantId
      if (tenantId) {
        try {
          // Cargar datos del tenant (no consultamos users para evitar problemas de permisos)
          const tenantResult = await supabase
            .from('tenants')
            .select('name, slug')
            .eq('id', tenantId)
            .maybeSingle();

          // Usar datos del JWT para el usuario
          userFullName = user.user_metadata?.full_name || userEmail.split('@')[0] || '';
          userEmail = user.email || '';
          finalRole = role;

          if (tenantResult.data) {
            const tenantData = tenantResult.data as { name?: string; slug?: string };
            tenantName = tenantData.name || '';
            tenantSlug = tenantData.slug || '';
          }
        } catch {
          // Silenciar errores - usar valores del JWT
        }
      }

      const contextData: TenantContextData = {
        userId: user.id,
        userEmail,
        userFullName,
        role: finalRole,
        tenantId: tenantId || '',
        tenantName,
        tenantSlug,
        agentId
      };

      // Guardar en cache
      setCachedContext(user.id, contextData);
      setContext(contextData);
      setError(null);
    } catch (e) {
      console.error('Error loading context:', e);
      setError('Error al cargar datos');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
      initialLoadDone.current = true;
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    try {
      clearCache();
      await supabase.auth.signOut();
      setContext(null);
      window.location.href = '/login';
    } catch (e) {
      console.error('Error signing out:', e);
    }
  }, [supabase]);

  // Cargar contexto inicial
  useEffect(() => {
    if (!initialLoadDone.current) {
      loadTenantContext();
    }
  }, [loadTenantContext]);

  // Escuchar cambios de autenticación
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearCache();
        setContext(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Solo recargar si no tenemos contexto o el usuario cambió
        if (!context || context.userId !== session?.user?.id) {
          loadTenantContext(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, loadTenantContext, context]);

  // Memoizar el valor del contexto
  const value: TenantContextValue = useMemo(() => ({
    ...defaultContextValue,
    ...context,
    isLoading,
    error,
    refresh: () => loadTenantContext(true),
    signOut
  }), [context, isLoading, error, loadTenantContext, signOut]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

// Hook para verificar si el usuario está autenticado
export function useIsAuthenticated() {
  const { userId, isLoading } = useTenant();
  return !isLoading && !!userId;
}
