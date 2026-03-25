'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { createClient } from '@/lib/supabase/client';

export interface SectionPermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_download: boolean;
}

export interface UserPermissions {
  clientes: SectionPermissions;
  polizas: SectionPermissions;
  pipeline: SectionPermissions;
  siniestros: SectionPermissions;
  facturacion: SectionPermissions;
  reportes: SectionPermissions;
  mensajes: SectionPermissions;
  automatizaciones: SectionPermissions;
  comparativos: SectionPermissions;
  cotizador: SectionPermissions;
}

const DEFAULT_PERMISSIONS: SectionPermissions = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_download: false,
};

const ADMIN_PERMISSIONS: SectionPermissions = {
  can_view: true,
  can_create: true,
  can_edit: true,
  can_download: true,
};

const ALL_SECTIONS = [
  'clientes', 'polizas', 'pipeline', 'siniestros',
  'facturacion', 'reportes', 'mensajes', 'automatizaciones', 'comparativos', 'cotizador'
] as const;

export function usePermissions() {
  const { userId, role } = useTenant();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadPermissions = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Si es admin, tiene todos los permisos
    if (role === 'admin' || role === 'superadmin') {
      const adminPerms: UserPermissions = {
        clientes: ADMIN_PERMISSIONS,
        polizas: ADMIN_PERMISSIONS,
        pipeline: ADMIN_PERMISSIONS,
        siniestros: ADMIN_PERMISSIONS,
        facturacion: ADMIN_PERMISSIONS,
        reportes: ADMIN_PERMISSIONS,
        mensajes: ADMIN_PERMISSIONS,
        automatizaciones: ADMIN_PERMISSIONS,
        comparativos: ADMIN_PERMISSIONS,
        cotizador: ADMIN_PERMISSIONS,
      };
      setPermissions(adminPerms);
      setLoading(false);
      return;
    }

    try {
      const { data } = await (supabase.from('user_permissions') as any)
        .select('section, can_view, can_create, can_edit, can_download')
        .eq('user_id', userId);

      // Crear objeto de permisos con valores por defecto
      const userPerms: UserPermissions = {
        clientes: { ...DEFAULT_PERMISSIONS },
        polizas: { ...DEFAULT_PERMISSIONS },
        pipeline: { ...DEFAULT_PERMISSIONS },
        siniestros: { ...DEFAULT_PERMISSIONS },
        facturacion: { ...DEFAULT_PERMISSIONS },
        reportes: { ...DEFAULT_PERMISSIONS },
        mensajes: { ...DEFAULT_PERMISSIONS },
        automatizaciones: { ...DEFAULT_PERMISSIONS },
        comparativos: { ...DEFAULT_PERMISSIONS },
        cotizador: { ...DEFAULT_PERMISSIONS },
      };

      // Aplicar permisos de la base de datos
      if (data) {
        data.forEach((perm: any) => {
          if (perm.section in userPerms) {
            userPerms[perm.section as keyof UserPermissions] = {
              can_view: perm.can_view || false,
              can_create: perm.can_create || false,
              can_edit: perm.can_edit || false,
              can_download: perm.can_download || false,
            };
          }
        });
      }

      setPermissions(userPerms);
    } catch (error) {
      console.error('Error loading permissions:', error);
      // En caso de error, usar permisos por defecto (sin acceso)
      const defaultPerms: UserPermissions = {
        clientes: { ...DEFAULT_PERMISSIONS },
        polizas: { ...DEFAULT_PERMISSIONS },
        pipeline: { ...DEFAULT_PERMISSIONS },
        siniestros: { ...DEFAULT_PERMISSIONS },
        facturacion: { ...DEFAULT_PERMISSIONS },
        reportes: { ...DEFAULT_PERMISSIONS },
        mensajes: { ...DEFAULT_PERMISSIONS },
        automatizaciones: { ...DEFAULT_PERMISSIONS },
        comparativos: { ...DEFAULT_PERMISSIONS },
        cotizador: { ...DEFAULT_PERMISSIONS },
      };
      setPermissions(defaultPerms);
    } finally {
      setLoading(false);
    }
  }, [userId, role, supabase]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Helper para verificar un permiso específico
  const can = (section: keyof UserPermissions, action: keyof SectionPermissions): boolean => {
    if (!permissions) return false;
    return permissions[section]?.[action] || false;
  };

  // Helper para verificar si puede ver una sección
  const canView = (section: keyof UserPermissions): boolean => can(section, 'can_view');
  const canCreate = (section: keyof UserPermissions): boolean => can(section, 'can_create');
  const canEdit = (section: keyof UserPermissions): boolean => can(section, 'can_edit');
  const canDownload = (section: keyof UserPermissions): boolean => can(section, 'can_download');

  // Helper para verificar si es admin
  const isAdmin = role === 'admin' || role === 'superadmin';

  return {
    permissions,
    loading,
    can,
    canView,
    canCreate,
    canEdit,
    canDownload,
    isAdmin,
    refresh: loadPermissions,
  };
}
