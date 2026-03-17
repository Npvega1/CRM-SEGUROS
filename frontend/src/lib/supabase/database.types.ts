// =====================================================
// TIPOS DE BASE DE DATOS SUPABASE
// Generados manualmente basados en el schema SQL
// En producción usar: npx supabase gen types typescript
// =====================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          stripe_customer_id: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          stripe_customer_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          stripe_customer_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          tenant_id: string | null;
          email: string;
          full_name: string;
          role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          avatar_url: string | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id?: string | null;
          email: string;
          full_name: string;
          role?: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          avatar_url?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          email?: string;
          full_name?: string;
          role?: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          avatar_url?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          granted_by: string | null;
          granted_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          role?: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
        };
      };
      invitations: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          role?: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          token: string;
          invited_by?: string | null;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          role?: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          token?: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      // =====================================================
      // MÓDULO 01: Clientes y Pólizas
      // =====================================================
      clients: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
          doc_number: string;
          email: string | null;
          phone: string | null;
          segment: 'individual' | 'empresa' | 'vip';
          agent_id: string | null;
          tags: string[];
          metadata: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          full_name: string;
          doc_type?: 'rut' | 'nit' | 'cedula' | 'pasaporte';
          doc_number: string;
          email?: string | null;
          phone?: string | null;
          segment?: 'individual' | 'empresa' | 'vip';
          agent_id?: string | null;
          tags?: string[];
          metadata?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          full_name?: string;
          doc_type?: 'rut' | 'nit' | 'cedula' | 'pasaporte';
          doc_number?: string;
          email?: string | null;
          phone?: string | null;
          segment?: 'individual' | 'empresa' | 'vip';
          agent_id?: string | null;
          tags?: string[];
          metadata?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      policies: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          policy_number: string;
          insurer: string;
          line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
          premium: number;
          currency: string;
          start_date: string | null;
          end_date: string | null;
          document_url: string | null;
          commission_pct: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          policy_number: string;
          insurer: string;
          line?: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          status?: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
          premium?: number;
          currency?: string;
          start_date?: string | null;
          end_date?: string | null;
          document_url?: string | null;
          commission_pct?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          policy_number?: string;
          insurer?: string;
          line?: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          status?: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
          premium?: number;
          currency?: string;
          start_date?: string | null;
          end_date?: string | null;
          document_url?: string | null;
          commission_pct?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      policy_history: {
        Row: {
          id: string;
          policy_id: string;
          changed_by: string | null;
          old_status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion' | null;
          new_status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
          note: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          policy_id: string;
          changed_by?: string | null;
          old_status?: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion' | null;
          new_status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
          note?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          policy_id?: string;
          changed_by?: string | null;
          old_status?: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion' | null;
          new_status?: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
          note?: string | null;
          changed_at?: string;
        };
      };
      automation_queue: {
        Row: {
          id: string;
          tenant_id: string;
          trigger_type: string;
          entity_type: string;
          entity_id: string;
          payload: Json;
          status: string;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          trigger_type: string;
          entity_type: string;
          entity_id: string;
          payload?: Json;
          status?: string;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          trigger_type?: string;
          entity_type?: string;
          entity_id?: string;
          payload?: Json;
          status?: string;
          processed_at?: string | null;
          created_at?: string;
        };
      };
      automation_logs: {
        Row: {
          id: string;
          tenant_id: string | null;
          automation_type: string;
          entity_type: string | null;
          entity_id: string | null;
          result: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          automation_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          result: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          automation_type?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          result?: string;
          details?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_clients: {
        Args: {
          p_tenant_id: string;
          p_query: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          full_name: string;
          doc_type: string;
          doc_number: string;
          email: string | null;
          phone: string | null;
          segment: string;
          similarity_score: number;
        }[];
      };
      get_expiring_policies: {
        Args: {
          p_tenant_id: string;
          p_days_ahead: number[];
        };
        Returns: {
          id: string;
          policy_number: string;
          client_id: string;
          client_name: string;
          insurer: string;
          line: string;
          premium: number;
          end_date: string;
          days_until_expiry: number;
        }[];
      };
    };
    Enums: {
      user_role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
      doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
      client_segment: 'individual' | 'empresa' | 'vip';
      policy_line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
      policy_status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
    };
  };
};
