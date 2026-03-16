// =====================================================
// TIPOS GLOBALES - CRM Multi-tenant Agencias de Seguros
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS Y TIPOS BASE
// =====================================================

/**
 * Roles disponibles en el sistema
 * - superadmin: Acceso total al sistema (solo interno)
 * - admin: Administrador de la agencia
 * - senior_agent: Agente senior con permisos adicionales
 * - agent: Agente estándar
 * - readonly: Solo lectura
 */
export const RoleEnum = z.enum([
  'superadmin',
  'admin',
  'senior_agent',
  'agent',
  'readonly'
]);

export type Role = z.infer<typeof RoleEnum>;

// =====================================================
// SCHEMAS ZOD - Validación en frontend y backend
// =====================================================

/**
 * Schema para Tenant (Agencia de Seguros)
 */
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  is_active: z.boolean().default(true),
  stripe_customer_id: z.string().max(100).nullable().optional(),
  settings: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const TenantCreateSchema = TenantSchema.pick({
  name: true,
  slug: true
}).extend({
  settings: z.record(z.unknown()).optional()
});

export const TenantUpdateSchema = TenantSchema.partial().omit({
  id: true,
  created_at: true
});

/**
 * Schema para User (Usuario del sistema)
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  email: z.string().email().max(150),
  full_name: z.string().min(1).max(200),
  role: RoleEnum,
  avatar_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true),
  last_login_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const UserCreateSchema = UserSchema.pick({
  email: true,
  full_name: true,
  role: true
}).extend({
  tenant_id: z.string().uuid().optional(),
  avatar_url: z.string().url().optional()
});

export const UserUpdateSchema = UserSchema.partial().omit({
  id: true,
  email: true,
  created_at: true
});

/**
 * Schema para UserRole (Roles adicionales)
 */
export const UserRoleSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: RoleEnum,
  granted_by: z.string().uuid().nullable().optional(),
  granted_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable().optional()
});

/**
 * Schema para Invitation (Invitaciones)
 */
export const InvitationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email().max(150),
  role: RoleEnum,
  token: z.string().max(200),
  invited_by: z.string().uuid().nullable().optional(),
  expires_at: z.string().datetime(),
  accepted_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime()
});

export const InvitationCreateSchema = InvitationSchema.pick({
  email: true,
  role: true
});

/**
 * Schema para AuditLog (Registro de auditoría)
 */
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  action: z.string().max(100),
  entity_type: z.string().max(100).nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  old_values: z.record(z.unknown()).nullable().optional(),
  new_values: z.record(z.unknown()).nullable().optional(),
  ip_address: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  created_at: z.string().datetime()
});

// =====================================================
// TIPOS TYPESCRIPT (inferidos de Zod)
// =====================================================

export type Tenant = z.infer<typeof TenantSchema>;
export type TenantCreate = z.infer<typeof TenantCreateSchema>;
export type TenantUpdate = z.infer<typeof TenantUpdateSchema>;

export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export type UserRole = z.infer<typeof UserRoleSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type InvitationCreate = z.infer<typeof InvitationCreateSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;

// =====================================================
// CONTEXTO DEL TENANT
// =====================================================

/**
 * Contexto del tenant para usar en toda la aplicación
 * Contiene información del usuario autenticado y su tenant
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: Role;
  agentId: string;
  tenantName: string;
  tenantSlug: string;
  userEmail: string;
  userFullName: string;
}

export const TenantContextSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: RoleEnum,
  agentId: z.string().uuid(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  userEmail: z.string().email(),
  userFullName: z.string()
});

// =====================================================
// TIPOS PARA RESPUESTAS Y ERRORES
// =====================================================

/**
 * Resultado genérico para operaciones (patrón Result)
 * Evita usar excepciones para control de flujo
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Error de aplicación tipado
 */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Helper para crear resultados exitosos
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper para crear resultados de error
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// =====================================================
// TIPOS PARA JWT CLAIMS
// =====================================================

/**
 * Claims personalizados en el JWT de Supabase
 */
export interface JWTClaims {
  tenant_id: string;
  role: Role;
  agent_id: string;
}

// =====================================================
// TIPOS PARA PAGINACIÓN
// =====================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// =====================================================
// CONSTANTES
// =====================================================

export const ROLES_HIERARCHY: Record<Role, number> = {
  superadmin: 100,
  admin: 80,
  senior_agent: 60,
  agent: 40,
  readonly: 20
};

/**
 * Verifica si un rol tiene permisos sobre otro
 */
export function hasPermissionOver(userRole: Role, targetRole: Role): boolean {
  return ROLES_HIERARCHY[userRole] > ROLES_HIERARCHY[targetRole];
}

/**
 * Verifica si un rol tiene al menos cierto nivel
 */
export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return ROLES_HIERARCHY[userRole] >= ROLES_HIERARCHY[minimumRole];
}
