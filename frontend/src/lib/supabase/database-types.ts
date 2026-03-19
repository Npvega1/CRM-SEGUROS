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
          settings: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          settings?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          settings?: Json | null;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          email: string;
          role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          full_name: string;
          email: string;
          role?: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          full_name?: string;
          email?: string;
          role?: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          tenant_id: string;
          doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
          doc_number: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          segment: 'individual' | 'empresa' | 'vip';
          agent_id: string | null;
          tags: string[];
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
          doc_number: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          segment?: 'individual' | 'empresa' | 'vip';
          agent_id?: string | null;
          tags?: string[];
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          doc_type?: 'rut' | 'nit' | 'cedula' | 'pasaporte';
          doc_number?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          segment?: 'individual' | 'empresa' | 'vip';
          agent_id?: string | null;
          tags?: string[];
          metadata?: Json | null;
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
          start_date: string;
          end_date: string;
          commission_pct: number;
          metadata: Json | null;
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
          start_date: string;
          end_date: string;
          commission_pct?: number;
          metadata?: Json | null;
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
          start_date?: string;
          end_date?: string;
          commission_pct?: number;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      automation_queue: {
        Row: {
          id: string;
          tenant_id: string;
          trigger_type: string;
          entity_type: string;
          entity_id: string;
          payload: Json | null;
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
          payload?: Json | null;
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
          payload?: Json | null;
          status?: string;
          processed_at?: string | null;
          created_at?: string;
        };
      };
      pipeline_stages: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          order_index: number;
          color: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          order_index: number;
          color?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          order_index?: number;
          color?: string;
          is_default?: boolean;
          created_at?: string;
        };
      };
      opportunities: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          stage_id: string;
          agent_id: string | null;
          line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          estimated_premium: number;
          close_probability: number;
          probability: number;
          expected_close_date: string | null;
          status: 'active' | 'won' | 'lost';
          lost_reason: string | null;
          converted_policy_id: string | null;
          notes: string | null;
          won_at: string | null;
          lost_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          stage_id: string;
          agent_id?: string | null;
          line?: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          estimated_premium?: number;
          close_probability?: number;
          probability?: number;
          expected_close_date?: string | null;
          status?: 'active' | 'won' | 'lost';
          lost_reason?: string | null;
          converted_policy_id?: string | null;
          notes?: string | null;
          won_at?: string | null;
          lost_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          stage_id?: string;
          agent_id?: string | null;
          line?: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          estimated_premium?: number;
          close_probability?: number;
          probability?: number;
          expected_close_date?: string | null;
          status?: 'active' | 'won' | 'lost';
          lost_reason?: string | null;
          converted_policy_id?: string | null;
          notes?: string | null;
          won_at?: string | null;
          lost_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          tenant_id: string;
          opportunity_id: string | null;
          client_id: string | null;
          agent_id: string | null;
          type: 'call' | 'email' | 'meeting' | 'task' | 'note';
          subject: string;
          description: string | null;
          scheduled_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          opportunity_id?: string | null;
          client_id?: string | null;
          agent_id?: string | null;
          type: 'call' | 'email' | 'meeting' | 'task' | 'note';
          subject: string;
          description?: string | null;
          scheduled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          opportunity_id?: string | null;
          client_id?: string | null;
          agent_id?: string | null;
          type?: 'call' | 'email' | 'meeting' | 'task' | 'note';
          subject?: string;
          description?: string | null;
          scheduled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      claims: {
        Row: {
          id: string;
          tenant_id: string;
          policy_id: string;
          client_id: string;
          agent_id: string | null;
          status: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed';
          incident_date: string;
          claimed_amount: number;
          approved_amount: number | null;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          policy_id: string;
          client_id: string;
          agent_id?: string | null;
          status?: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed';
          incident_date: string;
          claimed_amount?: number;
          approved_amount?: number | null;
          description: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          policy_id?: string;
          client_id?: string;
          agent_id?: string | null;
          status?: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed';
          incident_date?: string;
          claimed_amount?: number;
          approved_amount?: number | null;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      claims_history: {
        Row: {
          id: string;
          claim_id: string;
          changed_by: string | null;
          old_status: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed' | null;
          new_status: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed';
          comment: string | null;
          is_internal: boolean;
          changed_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          changed_by?: string | null;
          old_status?: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed' | null;
          new_status: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed';
          comment?: string | null;
          is_internal?: boolean;
          changed_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          changed_by?: string | null;
          old_status?: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed' | null;
          new_status?: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed';
          comment?: string | null;
          is_internal?: boolean;
          changed_at?: string;
        };
      };
      claim_documents: {
        Row: {
          id: string;
          claim_id: string;
          tenant_id: string;
          uploader_id: string | null;
          file_name: string;
          file_url: string;
          file_type: string;
          file_size: number | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          tenant_id: string;
          uploader_id?: string | null;
          file_name: string;
          file_url: string;
          file_type: string;
          file_size?: number | null;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          tenant_id?: string;
          uploader_id?: string | null;
          file_name?: string;
          file_url?: string;
          file_type?: string;
          file_size?: number | null;
          uploaded_at?: string;
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
          doc_number: string;
          email: string | null;
          phone: string | null;
          segment: string;
        }[];
      };
      get_executive_dashboard: {
        Args: {
          p_tenant_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          active_policies_count: number;
          total_premium_month: number;
          open_claims_count: number;
          renewals_next_30_days: number;
          pending_commissions_total: number;
          active_policies_prev: number;
          total_premium_prev: number;
          open_claims_prev: number;
        }[];
      };
      get_agent_performance: {
        Args: {
          p_tenant_id: string;
          p_agent_id?: string | null;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          agent_id: string;
          agent_name: string;
          policies_created_month: number;
          total_premium: number;
          pipeline_total: number;
          pipeline_won_month: number;
          close_rate: number;
          commissions_earned_month: number;
        }[];
      };
      get_portfolio_by_line: {
        Args: {
          p_tenant_id: string;
        };
        Returns: {
          line: string;
          count: number;
          premium: number;
          percentage: number;
        }[];
      };
      get_portfolio_by_insurer: {
        Args: {
          p_tenant_id: string;
        };
        Returns: {
          insurer: string;
          count: number;
          premium: number;
          percentage: number;
        }[];
      };
      get_premium_trend: {
        Args: {
          p_tenant_id: string;
        };
        Returns: {
          month: string;
          month_date: string;
          premium: number;
          policies_count: number;
        }[];
      };
      get_claims_analytics: {
        Args: {
          p_tenant_id: string;
        };
        Returns: {
          total_claims: number;
          open_claims: number;
          resolved_claims: number;
          avg_claimed_amount: number;
          avg_approved_amount: number;
          total_claimed: number;
          total_approved: number;
          loss_ratio: number;
          claims_by_status: { status: string; count: number }[];
          claims_by_line: { line: string; count: number; amount: number }[];
        }[];
      };
      get_renewal_report: {
        Args: {
          p_tenant_id: string;
          p_days?: number;
        };
        Returns: {
          policy_id: string;
          policy_number: string;
          client_id: string;
          client_name: string;
          client_email: string | null;
          client_phone: string | null;
          insurer: string;
          line: string;
          premium: number;
          commission: number;
          end_date: string;
          days_remaining: number;
          renewal_status: string;
        }[];
      };
      get_commissions_report: {
        Args: {
          p_tenant_id: string;
          p_agent_id?: string | null;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          policy_id: string;
          policy_number: string;
          client_name: string;
          insurer: string;
          line: string;
          premium: number;
          commission_pct: number;
          commission_amount: number;
          policy_status: string;
          created_at: string;
          agent_id: string | null;
          agent_name: string | null;
        }[];
      };
    };
    Enums: {
      user_role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
      doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
      client_segment: 'individual' | 'empresa' | 'vip';
      policy_line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
      policy_status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
      opportunity_status: 'active' | 'won' | 'lost';
      activity_type: 'call' | 'email' | 'meeting' | 'task' | 'note';
      claim_status: 'reported' | 'investigating' | 'docs_complete' | 'processing' | 'resolved' | 'closed';
    };
  };
};
