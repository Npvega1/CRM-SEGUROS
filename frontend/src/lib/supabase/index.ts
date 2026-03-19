// =====================================================
// INDEX DE EXPORTS - SUPABASE
// =====================================================

export { createClient, getClient } from './client';
export { createClient as createServerClient, getSession, getUser } from './server';
export { createAdminClient, updateUserClaims, createUserWithTenant } from './admin';
export type { Database, Json } from './database-types';
