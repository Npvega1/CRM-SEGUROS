// =====================================================
// VALIDACIONES ZOD - Portal del Cliente
// Módulo 07: Portal del Cliente (White-Label)
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

/**
 * Rol del remitente en mensajes
 */
export const MessageSenderRoleEnum = z.enum(['client', 'agent']);
export type MessageSenderRole = z.infer<typeof MessageSenderRoleEnum>;

/**
 * Tipo de solicitud del cliente
 */
export const ClientRequestTypeEnum = z.enum(['new_claim', 'info_request', 'complaint']);
export type ClientRequestType = z.infer<typeof ClientRequestTypeEnum>;

/**
 * Estado de solicitud del cliente
 */
export const ClientRequestStatusEnum = z.enum(['open', 'closed']);
export type ClientRequestStatus = z.infer<typeof ClientRequestStatusEnum>;

// =====================================================
// SCHEMAS ZOD - Tenant Settings
// =====================================================

/**
 * Schema para configuración del tenant (branding)
 */
export const TenantSettingsSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  logo_url: z.string().url().nullable().optional(),
  favicon_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3b82f6'),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1e40af'),
  font_family: z.string().default('Inter'),
  font_size_base: z.number().int().min(10).max(20).default(14),
  portal_enabled: z.boolean().default(true),
  portal_welcome_message: z.string().nullable().optional(),
  support_email: z.string().email().nullable().optional(),
  support_phone: z.string().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

// =====================================================
// SCHEMAS ZOD - Portal Sessions
// =====================================================

/**
 * Schema para sesión del portal
 */
export const PortalSessionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  client_id: z.string().uuid(),
  auth_user_id: z.string().uuid().nullable().optional(),
  last_seen: z.string().datetime(),
  device_info: z.record(z.string(), z.unknown()).default({}),
  ip_address: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime()
});

export type PortalSession = z.infer<typeof PortalSessionSchema>;

// =====================================================
// SCHEMAS ZOD - Messages
// =====================================================

/**
 * Schema para mensaje de chat
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  client_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable().optional(),
  sender_role: MessageSenderRoleEnum,
  body: z.string().min(1).max(5000),
  is_read: z.boolean().default(false),
  read_at: z.string().datetime().nullable().optional(),
  sent_at: z.string().datetime()
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Schema para enviar mensaje
 */
export const SendMessageInputSchema = z.object({
  body: z.string()
    .min(1, 'El mensaje no puede estar vacío')
    .max(5000, 'Máximo 5000 caracteres')
});

export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

// =====================================================
// SCHEMAS ZOD - Client Requests
// =====================================================

/**
 * Schema para solicitud del cliente
 */
export const ClientRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  client_id: z.string().uuid(),
  type: ClientRequestTypeEnum,
  status: ClientRequestStatusEnum,
  description: z.string(),
  policy_id: z.string().uuid().nullable().optional(),
  claim_id: z.string().uuid().nullable().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
  resolved_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ClientRequest = z.infer<typeof ClientRequestSchema>;

/**
 * Schema para crear solicitud de siniestro desde el portal
 */
export const PortalClaimRequestSchema = z.object({
  policy_id: z.string().uuid('Selecciona una póliza'),
  incident_date: z.string()
    .min(1, 'La fecha del incidente es requerida'),
  description: z.string()
    .min(20, 'Describe el incidente con al menos 20 caracteres')
    .max(2000, 'Máximo 2000 caracteres')
});

export type PortalClaimRequest = z.infer<typeof PortalClaimRequestSchema>;

/**
 * Schema para solicitud de información
 */
export const InfoRequestSchema = z.object({
  type: z.literal('info_request'),
  description: z.string()
    .min(10, 'Describe tu solicitud con al menos 10 caracteres')
    .max(2000, 'Máximo 2000 caracteres'),
  policy_id: z.string().uuid().optional()
});

export type InfoRequest = z.infer<typeof InfoRequestSchema>;

/**
 * Schema para queja/reclamo
 */
export const ComplaintRequestSchema = z.object({
  type: z.literal('complaint'),
  description: z.string()
    .min(20, 'Describe tu queja con al menos 20 caracteres')
    .max(2000, 'Máximo 2000 caracteres')
});

export type ComplaintRequest = z.infer<typeof ComplaintRequestSchema>;

// =====================================================
// SCHEMAS ZOD - Login Portal
// =====================================================

/**
 * Schema para login con magic link
 */
export const PortalLoginSchema = z.object({
  email: z.string()
    .email('Ingresa un email válido')
    .min(1, 'El email es requerido')
});

export type PortalLogin = z.infer<typeof PortalLoginSchema>;

// =====================================================
// SCHEMAS ZOD - Portal Summary
// =====================================================

/**
 * Schema para resumen del portal
 */
export const PortalSummarySchema = z.object({
  active_policies_count: z.number().int(),
  next_renewal: z.string().nullable(),
  active_claims_count: z.number().int(),
  pending_invoices_count: z.number().int(),
  unread_messages_count: z.number().int()
});

export type PortalSummary = z.infer<typeof PortalSummarySchema>;

// =====================================================
// TIPOS EXTENDIDOS PARA UI
// =====================================================

/**
 * Mensaje con información del remitente
 */
export interface MessageWithSender extends Message {
  sender_name?: string;
  sender_avatar?: string;
}

/**
 * Cliente del portal con datos del tenant
 */
export interface PortalClient {
  client_id: string;
  client_name: string;
  client_email: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  agent_id: string | null;
  agent_name?: string;
}

/**
 * Contexto del portal
 */
export interface PortalContextData {
  client: PortalClient;
  settings: TenantSettings | null;
  summary: PortalSummary | null;
  isLoading: boolean;
  error: string | null;
}

// =====================================================
// CONSTANTES - LABELS Y COLORES
// =====================================================

/**
 * Labels para tipos de solicitud
 */
export const CLIENT_REQUEST_TYPE_LABELS: Record<ClientRequestType, string> = {
  new_claim: 'Nuevo Siniestro',
  info_request: 'Solicitud de Información',
  complaint: 'Queja o Reclamo'
};

/**
 * Labels para estados de solicitud
 */
export const CLIENT_REQUEST_STATUS_LABELS: Record<ClientRequestStatus, string> = {
  open: 'Abierta',
  closed: 'Cerrada'
};

/**
 * Colores para estados de solicitud
 */
export const CLIENT_REQUEST_STATUS_COLORS: Record<ClientRequestStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  closed: 'bg-green-100 text-green-800 border-green-300'
};

/**
 * Colores para tipos de solicitud
 */
export const CLIENT_REQUEST_TYPE_COLORS: Record<ClientRequestType, string> = {
  new_claim: 'bg-red-100 text-red-800 border-red-300',
  info_request: 'bg-blue-100 text-blue-800 border-blue-300',
  complaint: 'bg-orange-100 text-orange-800 border-orange-300'
};

// =====================================================
// HELPERS
// =====================================================

/**
 * Formatea fecha para mostrar en el portal
 */
export function formatPortalDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formatea fecha y hora para mensajes
 */
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (days === 1) {
    return 'Ayer ' + date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (days < 7) {
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else {
    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * Formatea monto con moneda
 */
export function formatPortalCurrency(amount: number, currency: string = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Calcula días hasta una fecha
 */
export function daysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Genera color hex más claro
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}
