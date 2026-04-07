// =====================================================
// VALIDACIONES ZOD - Siniestros
// Módulo 03: Gestión de Siniestros
// TypeScript estricto - NO usar 'any'
// =====================================================

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

/**
 * Estado del siniestro
 */
export const ClaimStatusEnum = z.enum([
  'reported',       // Reportado
  'investigating',  // En investigación (legacy, se mantiene por BD)
  'docs_complete',  // Documentación completa
  'processing',     // En procesamiento
  'resolved',       // Finalizado - Aprobado y Pagado
  'closed'          // Finalizado - Denegado
]);
export type ClaimStatus = z.infer<typeof ClaimStatusEnum>;

// =====================================================
// SCHEMAS ZOD - Claims
// =====================================================

/**
 * Schema completo de Claim (siniestro)
 */
export const ClaimSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  client_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable().optional(),
  status: ClaimStatusEnum,
  incident_date: z.string(),
  claimed_amount: z.number().min(0),
  approved_amount: z.number().min(0).nullable().optional(),
  description: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

/**
 * Schema para abrir un nuevo siniestro
 */
export const OpenClaimInputSchema = z.object({
  policy_id: z.string().uuid('Póliza inválida'),
  client_id: z.string().uuid('Cliente inválido'),
  incident_date: z.string()
    .min(1, 'La fecha del incidente es requerida'),
  claimed_amount: z.coerce.number()
    .min(0, 'El monto reclamado debe ser mayor o igual a 0'),
  description: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'Máximo 2000 caracteres')
});

/**
 * Schema para actualizar estado de siniestro
 */
export const UpdateClaimStatusInputSchema = z.object({
  claim_id: z.string().uuid(),
  new_status: ClaimStatusEnum,
  comment: z.string().max(1000).optional().nullable(),
  is_internal: z.boolean().default(false)
});

/**
 * Schema para actualizar monto aprobado
 */
export const UpdateApprovedAmountInputSchema = z.object({
  claim_id: z.string().uuid(),
  approved_amount: z.coerce.number()
    .min(0, 'El monto aprobado debe ser mayor o igual a 0')
});

/**
 * Schema para subir documento de siniestro
 */
export const UploadClaimDocumentInputSchema = z.object({
  claim_id: z.string().uuid(),
  file_name: z.string().min(1).max(200),
  file_url: z.string().url(),
  file_type: z.string().min(1).max(50),
  file_size: z.number().int().min(0).optional()
});

/**
 * Schema para historial de siniestro
 */
export const ClaimHistorySchema = z.object({
  id: z.string().uuid(),
  claim_id: z.string().uuid(),
  changed_by: z.string().uuid().nullable(),
  changed_by_name: z.string().nullable().optional(),
  old_status: ClaimStatusEnum.nullable(),
  new_status: ClaimStatusEnum,
  comment: z.string().nullable(),
  is_internal: z.boolean(),
  changed_at: z.string().datetime()
});

/**
 * Schema para documento de siniestro
 */
export const ClaimDocumentSchema = z.object({
  id: z.string().uuid(),
  claim_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  uploader_id: z.string().uuid().nullable(),
  uploader_name: z.string().nullable().optional(),
  file_name: z.string(),
  file_url: z.string(),
  file_type: z.string(),
  file_size: z.number().nullable().optional(),
  uploaded_at: z.string().datetime()
});

// =====================================================
// TIPOS TYPESCRIPT
// =====================================================

export type Claim = z.infer<typeof ClaimSchema>;
export type OpenClaimInput = z.infer<typeof OpenClaimInputSchema>;
export type UpdateClaimStatusInput = z.infer<typeof UpdateClaimStatusInputSchema>;
export type UpdateApprovedAmountInput = z.infer<typeof UpdateApprovedAmountInputSchema>;
export type UploadClaimDocumentInput = z.infer<typeof UploadClaimDocumentInputSchema>;
export type ClaimHistory = z.infer<typeof ClaimHistorySchema>;
export type ClaimDocument = z.infer<typeof ClaimDocumentSchema>;

// =====================================================
// TIPOS EXTENDIDOS PARA UI
// =====================================================

/**
 * Siniestro con datos relacionados (para mostrar en UI)
 */
export interface ClaimWithRelations extends Claim {
  client?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  policy?: {
    id: string;
    policy_number: string;
    insurer: string;
    line: string;
  };
  agent?: {
    id: string;
    full_name: string;
  };
}

/**
 * Expediente completo del siniestro
 */
export interface ClaimExpediente {
  claim: ClaimWithRelations & { agent_name?: string };
  policy: {
    id: string;
    policy_number: string;
    insurer: string;
    line: string;
    status: string;
    premium: number;
    start_date: string | null;
    end_date: string | null;
  };
  client: {
    id: string;
    full_name: string;
    doc_type: string;
    doc_number: string;
    email: string | null;
    phone: string | null;
    segment: string;
  };
  history: ClaimHistory[];
  documents: ClaimDocument[];
}

// =====================================================
// CONSTANTES - TRANSICIONES DE ESTADO VÁLIDAS
// =====================================================

/**
 * Transiciones de estado válidas para siniestros
 * Flujo: Reportado → Docs. Completos → En Proceso → Finalizado
 */
export const VALID_CLAIM_STATUS_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  reported: ['docs_complete', 'closed'],
  investigating: ['docs_complete', 'closed'],
  docs_complete: ['processing', 'reported', 'closed'],
  processing: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: []
};

/**
 * Verifica si una transición de estado es válida
 */
export function isValidClaimStatusTransition(
  currentStatus: ClaimStatus,
  newStatus: ClaimStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return VALID_CLAIM_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Obtiene las transiciones válidas desde un estado
 */
export function getValidTransitions(currentStatus: ClaimStatus): ClaimStatus[] {
  return VALID_CLAIM_STATUS_TRANSITIONS[currentStatus];
}

// =====================================================
// HELPERS - UI
// =====================================================

/**
 * Labels para estados de siniestro
 */
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  reported: 'Reportado',
  investigating: 'En Investigación',
  docs_complete: 'Docs. Completos',
  processing: 'En Proceso',
  resolved: 'Aprobado / Pagado',
  closed: 'Denegado'
};

/**
 * Colores para estados de siniestro (Tailwind classes)
 */
export const CLAIM_STATUS_COLORS: Record<ClaimStatus, string> = {
  reported: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  investigating: 'bg-orange-100 text-orange-800 border-orange-300',
  docs_complete: 'bg-blue-100 text-blue-800 border-blue-300',
  processing: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  resolved: 'bg-green-100 text-green-800 border-green-300',
  closed: 'bg-red-100 text-red-800 border-red-300'
};

/**
 * Colores para el stepper de estados (4 pasos)
 */
export const CLAIM_STATUS_STEPPER_COLORS: Record<ClaimStatus, { bg: string; text: string; border: string }> = {
  reported: { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-500' },
  investigating: { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-500' },
  docs_complete: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500' },
  processing: { bg: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-500' },
  resolved: { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-500' },
  closed: { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-500' }
};

/**
 * Orden de los estados para el stepper visual (4 pasos)
 */
export const CLAIM_STATUS_ORDER: ClaimStatus[] = [
  'reported',
  'docs_complete',
  'processing',
  'resolved'
];

/**
 * Labels específicos para el stepper (4 pasos)
 */
export const CLAIM_STEPPER_LABELS: Record<string, string> = {
  reported: 'Reportado',
  docs_complete: 'Docs. Completos',
  processing: 'En Proceso',
  resolved: 'Finalizado'
};

/**
 * Obtiene el índice del estado actual para el stepper de 4 pasos
 */
export function getStatusIndex(status: ClaimStatus): number {
  // Mapear estados al stepper de 4 pasos
  if (status === 'reported' || status === 'investigating') return 0;
  if (status === 'docs_complete') return 1;
  if (status === 'processing') return 2;
  if (status === 'resolved' || status === 'closed') return 3;
  return 0;
}

/**
 * Formatea el monto con moneda
 */
export function formatClaimAmount(amount: number, currency: string = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Formatea fecha para mostrar
 */
export function formatClaimDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formatea fecha y hora para mostrar
 */
export function formatClaimDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Verifica si un tipo de archivo es imagen
 */
export function isImageFile(fileType: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(fileType.toLowerCase());
}

/**
 * Obtiene el icono según el tipo de archivo
 */
export function getFileTypeIcon(fileType: string): string {
  if (isImageFile(fileType)) return 'Image';
  if (fileType.includes('pdf')) return 'FileText';
  if (fileType.includes('word') || fileType.includes('document')) return 'FileType';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'Table';
  return 'File';
}

/**
 * Formatea el tamaño del archivo
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Labels para líneas de seguro (ramo)
 */
export const POLICY_LINE_LABELS: Record<string, string> = {
  vida: 'Vida',
  auto: 'Auto',
  salud: 'Salud',
  hogar: 'Hogar',
  soat: 'SOAT',
  otro: 'Otro'
};
