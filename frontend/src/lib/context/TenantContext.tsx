'use client';

// =====================================================
// CONTEXTO DEL TENANT - Provider y Hook
// Para acceder a información del tenant en toda la app
// =====================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { TenantContext as TenantContextType, Role } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

// =====================================================
// TIPOS
// =====================================================

interface TenantProviderProps {
  children: ReactNode;
}

interface TenantContextValue extends TenantContextType {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Valor inicial para el contexto (nunca se usa directamente)
const defaultContextValue: TenantContextValue = {
  tenantId: '',
  userId: '',
  role: 'readonly',
  agentId: '',
  tenantName: '',
  tenantSlug: '',
  userEmail: '',
  userFullName: '',
  isLoading: true,
  error: null,
  refresh: async () => {},
  signOut: async () => {}
};

// =====================================================
// CONTEXTO
// =====================================================

const TenantContext = createContext<TenantContextValue | null>(null);

// =====================================================
// PROVIDER
// =====================================================

export function TenantProvider({ children }: TenantProviderProps) {
  const [context, setContext] = useState<TenantContextType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  /**
   * Carga los datos del tenant y usuario desde Supabase
   */
  const loadTenantContext = useCallback(async () => {
    console.log('TenantContext: Iniciando carga...');
    
    try {
      setIsLoading(true);
      setError(null);

      // Obtener sesión actual con timeout
      console.log('TenantContext: Obteniendo sesión...');
      
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout obteniendo sesión')), 5000)
      );
      
      let session;
      let sessionError;
      
      try {
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        session = result.data?.session;
        sessionError = result.error;
      } catch (e) {
        console.warn('TenantContext: Timeout o error en getSession', e);
        // Continuar sin sesión
        setContext(null);
        setIsLoading(false);
        return;
      }
      
      if (sessionError) {
        console.error('TenantContext: Error de sesión', sessionError);
        setContext(null);
        setIsLoading(false);
        return;
      }

      if (!session?.user) {
        console.log('TenantContext: No hay sesión activa');
        setContext(null);
        setIsLoading(false);
        return;
      }

      const user = session.user;
      console.log('TenantContext: Usuario encontrado', user.id);
      
      // Obtener claims del JWT (app_metadata)
      const appMetadata = user.app_metadata || {};
      const tenantId = appMetadata.tenant_id as string | undefined;
      const role = (appMetadata.role as Role) || 'readonly';
      const agentId = (appMetadata.agent_id as string) || user.id;

      console.log('TenantContext: Claims JWT', { tenantId, role, agentId });

      // Valores por defecto
      let userFullName = user.user_metadata?.full_name || '';
      let userEmail = user.email || '';
      let tenantName = '';
      let tenantSlug = '';
      let finalRole = role;

      // Intentar obtener datos adicionales solo si hay tenantId
      if (tenantId) {
        try {
          console.log('TenantContext: Consultando tabla users...');
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('full_name, email, role')
            .eq('id', user.id)
            .maybeSingle();

          if (userError) {
            console.warn('TenantContext: Error consultando users', userError.message);
          } else if (userData) {
            console.log('TenantContext: Datos de usuario obtenidos', userData);
            userFullName = userData.full_name || userFullName;
            userEmail = userData.email || userEmail;
            finalRole = userData.role || role;
          }
        } catch (e) {
          console.warn('TenantContext: Excepción consultando users', e);
        }

        try {
          console.log('TenantContext: Consultando tabla tenants...');
          const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('name, slug')
            .eq('id', tenantId)
            .maybeSingle();

          if (tenantError) {
            console.warn('TenantContext: Error consultando tenants', tenantError.message);
          } else if (tenantData) {
            console.log('TenantContext: Datos de tenant obtenidos', tenantData);
            tenantName = tenantData.name || '';
            tenantSlug = tenantData.slug || '';
          }
        } catch (e) {
          console.warn('TenantContext: Excepción consultando tenants', e);
        }
      }

      const contextData = {
        tenantId: tenantId || '',
        userId: user.id,
        role: finalRole,
        agentId,
        tenantName,
        tenantSlug,
        userEmail,
        userFullName
      };

      console.log('TenantContext: Configurando contexto', contextData);
      setContext(contextData);
      setIsLoading(false);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      console.error('TenantContext: Error cargando contexto:', message);
      setIsLoading(false);
    }
  }, [supabase]);

  /**
   * Cerrar sesión
   */
  const signOut = useCallback(async () => {
    console.log('TenantContext: Cerrando sesión...');
    try {
      await supabase.auth.signOut();
      setContext(null);
      setIsLoading(false);
      // Redirigir al login
      window.location.href = '/login';
    } catch (e) {
      console.error('Error cerrando sesión:', e);
      // Forzar redirección aunque falle
      window.location.href = '/login';
    }
  }, [supabase]);

  // Cargar contexto al montar
  useEffect(() => {
    loadTenantContext();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await loadTenantContext();
        } else if (event === 'SIGNED_OUT') {
          setContext(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadTenantContext, supabase.auth]);

  const value: TenantContextValue = context
    ? {
        ...context,
        isLoading,
        error,
        refresh: loadTenantContext,
        signOut
      }
    : {
        ...defaultContextValue,
        isLoading,
        error,
        refresh: loadTenantContext,
        signOut
      };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

// =====================================================
// HOOK
// =====================================================

/**
 * Hook para acceder al contexto del tenant
 * Debe usarse dentro de TenantProvider
 * 
 * @throws Error si se usa fuera del Provider
 */
export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  
  if (context === null) {
    throw new Error(
      'useTenant debe ser usado dentro de un TenantProvider. ' +
      'Asegúrate de envolver tu aplicación con <TenantProvider>.'
    );
  }
  
  return context;
}

/**
 * Hook para verificar si el usuario tiene al menos cierto rol
 */
export function useHasRole(minimumRole: Role): boolean {
  const { role } = useTenant();
  
  const hierarchy: Record<Role, number> = {
    superadmin: 100,
    admin: 80,
    senior_agent: 60,
    agent: 40,
    readonly: 20
  };
  
  return hierarchy[role] >= hierarchy[minimumRole];
}

/**
 * Hook para verificar si el usuario está autenticado
 */
export function useIsAuthenticated(): boolean {
  const { userId, isLoading } = useTenant();
  return !isLoading && !!userId;
}
