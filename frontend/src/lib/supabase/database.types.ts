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
      ai_prompts: {
        Row: {
          id: string;
          name: string;
          line: string | null;
          prompt_system: string;
          prompt_recommendation: string;
          model_id: string;
          status: 'active' | 'draft' | 'deprecated';
          version: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          line?: string | null;
          prompt_system: string;
          prompt_recommendation: string;
          model_id?: string;
          status?: 'active' | 'draft' | 'deprecated';
          version?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          line?: string | null;
          prompt_system?: string;
          prompt_recommendation?: string;
          model_id?: string;
          status?: 'active' | 'draft' | 'deprecated';
          version?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_prompt_versions: {
        Row: {
          id: string;
          prompt_id: string;
          prompt_system: string;
          prompt_recommendation: string;
          model_id: string;
          version: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_id: string;
          prompt_system: string;
          prompt_recommendation: string;
          model_id: string;
          version: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          prompt_id?: string;
          prompt_system?: string;
          prompt_recommendation?: string;
          model_id?: string;
          version?: number;
          created_by?: string | null;
          created_at?: string;
        };
      };
      platform_analytics: {
        Row: {
          id: string;
          date: string;
          total_tenants: number;
          active_tenants: number;
          trial_tenants: number;
          mrr_total: number;
          new_tenants_month: number;
          total_api_calls: number;
          total_tokens_consumed: number;
          estimated_ai_cost: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          total_tenants?: number;
          active_tenants?: number;
          trial_tenants?: number;
          mrr_total?: number;
          new_tenants_month?: number;
          total_api_calls?: number;
          total_tokens_consumed?: number;
          estimated_ai_cost?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          total_tenants?: number;
          active_tenants?: number;
          trial_tenants?: number;
          mrr_total?: number;
          new_tenants_month?: number;
          total_api_calls?: number;
          total_tokens_consumed?: number;
          estimated_ai_cost?: number;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
      prompt_status: 'active' | 'draft' | 'deprecated';
    };
  };
};
