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
          expected_close_date: string | null;
          status: 'active' | 'won' | 'lost';
          lost_reason: string | null;
          converted_policy_id: string | null;
          notes: string | null;
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
          expected_close_date?: string | null;
          status?: 'active' | 'won' | 'lost';
          lost_reason?: string | null;
          converted_policy_id?: string | null;
          notes?: string | null;
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
          expected_close_date?: string | null;
          status?: 'active' | 'won' | 'lost';
          lost_reason?: string | null;
          converted_policy_id?: string | null;
          notes?: string | null;
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
    };
    Enums: {
      user_role: 'superadmin' | 'admin' | 'senior_agent' | 'agent' | 'readonly';
      doc_type: 'rut' | 'nit' | 'cedula' | 'pasaporte';
      client_segment: 'individual' | 'empresa' | 'vip';
      policy_line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
      policy_status: 'cotizacion' | 'activa' | 'vencida' | 'cancelada' | 'renovacion';
      opportunity_status: 'active' | 'won' | 'lost';
      activity_type: 'call' | 'email' | 'meeting' | 'task' | 'note';
    };
  };
};
