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
          is_active: boolean;
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
          is_active?: boolean;
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
          start_date: string;
          end_date: string;
          commission_pct: number;
          metadata: Json | null;
          document_url: string | null;
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
          document_url?: string | null;
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
          document_url?: string | null;
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
      invoices: {
        Row: {
          id: string;
          tenant_id: string;
          policy_id: string;
          client_id: string;
          amount: number;
          due_date: string;
          status: 'pending' | 'paid' | 'overdue' | 'waived';
          paid_date: string | null;
          receipt_url: string | null;
          frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
          installment_number: number;
          total_installments: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          policy_id: string;
          client_id: string;
          amount?: number;
          due_date: string;
          status?: 'pending' | 'paid' | 'overdue' | 'waived';
          paid_date?: string | null;
          receipt_url?: string | null;
          frequency?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
          installment_number?: number;
          total_installments?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          policy_id?: string;
          client_id?: string;
          amount?: number;
          due_date?: string;
          status?: 'pending' | 'paid' | 'overdue' | 'waived';
          paid_date?: string | null;
          receipt_url?: string | null;
          frequency?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
          installment_number?: number;
          total_installments?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      commission_rates: {
        Row: {
          id: string;
          tenant_id: string;
          insurer: string;
          line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          rate_pct: number;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          insurer: string;
          line: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          rate_pct?: number;
          effective_from: string;
          effective_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          insurer?: string;
          line?: 'vida' | 'auto' | 'salud' | 'hogar' | 'soat' | 'otro';
          rate_pct?: number;
          effective_from?: string;
          effective_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      commissions: {
        Row: {
          id: string;
          tenant_id: string;
          policy_id: string;
          agent_id: string | null;
          amount: number;
          rate_pct: number;
          status: 'pending' | 'collected' | 'void';
          period_month: string;
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          policy_id: string;
          agent_id?: string | null;
          amount?: number;
          rate_pct?: number;
          status?: 'pending' | 'collected' | 'void';
          period_month: string;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          policy_id?: string;
          agent_id?: string | null;
          amount?: number;
          rate_pct?: number;
          status?: 'pending' | 'collected' | 'void';
          period_month?: string;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      commission_splits: {
        Row: {
          id: string;
          commission_id: string;
          agent_id: string;
          split_pct: number;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          commission_id: string;
          agent_id: string;
          split_pct?: number;
          amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          commission_id?: string;
          agent_id?: string;
          split_pct?: number;
          amount?: number;
          created_at?: string;
        };
      };
      automations: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          trigger_event: 'policy.expiring' | 'policy.activated' | 'invoice.overdue' | 'claim.created' | 'claim.status_changed' | 'opportunity.stage_changed' | 'client.created';
          conditions: Record<string, unknown>[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          trigger_event: 'policy.expiring' | 'policy.activated' | 'invoice.overdue' | 'claim.created' | 'claim.status_changed' | 'opportunity.stage_changed' | 'client.created';
          conditions?: Record<string, unknown>[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          trigger_event?: 'policy.expiring' | 'policy.activated' | 'invoice.overdue' | 'claim.created' | 'claim.status_changed' | 'opportunity.stage_changed' | 'client.created';
          conditions?: Record<string, unknown>[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      automation_actions: {
        Row: {
          id: string;
          automation_id: string;
          action_type: 'send_email' | 'create_task' | 'in_app_notification' | 'move_pipeline_stage';
          action_config: Record<string, unknown>;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          automation_id: string;
          action_type: 'send_email' | 'create_task' | 'in_app_notification' | 'move_pipeline_stage';
          action_config?: Record<string, unknown>;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          automation_id?: string;
          action_type?: 'send_email' | 'create_task' | 'in_app_notification' | 'move_pipeline_stage';
          action_config?: Record<string, unknown>;
          order_index?: number;
          created_at?: string;
        };
      };
      automation_queue_v2: {
        Row: {
          id: string;
          tenant_id: string;
          automation_id: string | null;
          trigger_event: 'policy.expiring' | 'policy.activated' | 'invoice.overdue' | 'claim.created' | 'claim.status_changed' | 'opportunity.stage_changed' | 'client.created';
          entity_id: string;
          payload: Record<string, unknown>;
          status: 'pending' | 'processing' | 'done' | 'error';
          error_msg: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          automation_id?: string | null;
          trigger_event: 'policy.expiring' | 'policy.activated' | 'invoice.overdue' | 'claim.created' | 'claim.status_changed' | 'opportunity.stage_changed' | 'client.created';
          entity_id: string;
          payload?: Record<string, unknown>;
          status?: 'pending' | 'processing' | 'done' | 'error';
          error_msg?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          automation_id?: string | null;
          trigger_event?: 'policy.expiring' | 'policy.activated' | 'invoice.overdue' | 'claim.created' | 'claim.status_changed' | 'opportunity.stage_changed' | 'client.created';
          entity_id?: string;
          payload?: Record<string, unknown>;
          status?: 'pending' | 'processing' | 'done' | 'error';
          error_msg?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
      };
      automation_logs_v2: {
        Row: {
          id: string;
          tenant_id: string;
          automation_id: string | null;
          queue_id: string | null;
          action_id: string | null;
          status: 'success' | 'error';
          response: Record<string, unknown> | null;
          error_msg: string | null;
          executed_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          automation_id?: string | null;
          queue_id?: string | null;
          action_id?: string | null;
          status: 'success' | 'error';
          response?: Record<string, unknown> | null;
          error_msg?: string | null;
          executed_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          automation_id?: string | null;
          queue_id?: string | null;
          action_id?: string | null;
          status?: 'success' | 'error';
          response?: Record<string, unknown> | null;
          error_msg?: string | null;
          executed_at?: string;
        };
      };
      email_templates: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          subject: string;
          html_body: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          subject: string;
          html_body: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          subject?: string;
          html_body?: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          title: string;
          body: string | null;
          is_read: boolean;
          entity_type: string | null;
          entity_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          title: string;
          body?: string | null;
          is_read?: boolean;
          entity_type?: string | null;
          entity_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          title?: string;
          body?: string | null;
          is_read?: boolean;
          entity_type?: string | null;
          entity_id?: string | null;
          created_at?: string;
        };
      };
      // Portal M07 Tables
      tenant_settings: {
        Row: {
          id: string;
          tenant_id: string;
          logo_url: string | null;
          favicon_url: string | null;
          primary_color: string;
          secondary_color: string;
          font_family: string;
          font_size_base: number;
          portal_enabled: boolean;
          portal_welcome_message: string | null;
          support_email: string | null;
          support_phone: string | null;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          font_family?: string;
          font_size_base?: number;
          portal_enabled?: boolean;
          portal_welcome_message?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          font_family?: string;
          font_size_base?: number;
          portal_enabled?: boolean;
          portal_welcome_message?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      portal_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          auth_user_id: string | null;
          last_seen: string;
          device_info: Record<string, unknown>;
          ip_address: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          auth_user_id?: string | null;
          last_seen?: string;
          device_info?: Record<string, unknown>;
          ip_address?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          auth_user_id?: string | null;
          last_seen?: string;
          device_info?: Record<string, unknown>;
          ip_address?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          agent_id: string | null;
          sender_role: 'client' | 'agent';
          body: string;
          is_read: boolean;
          read_at: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          agent_id?: string | null;
          sender_role: 'client' | 'agent';
          body: string;
          is_read?: boolean;
          read_at?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          agent_id?: string | null;
          sender_role?: 'client' | 'agent';
          body?: string;
          is_read?: boolean;
          read_at?: string | null;
          sent_at?: string;
        };
      };
      client_requests: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          type: 'new_claim' | 'info_request' | 'complaint';
          status: 'open' | 'closed';
          description: string;
          policy_id: string | null;
          claim_id: string | null;
          assigned_agent_id: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          type: 'new_claim' | 'info_request' | 'complaint';
          status?: 'open' | 'closed';
          description: string;
          policy_id?: string | null;
          claim_id?: string | null;
          assigned_agent_id?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          type?: 'new_claim' | 'info_request' | 'complaint';
          status?: 'open' | 'closed';
          description?: string;
          policy_id?: string | null;
          claim_id?: string | null;
          assigned_agent_id?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Super Admin M11 Tables
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
      comparisons: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string | null;
          created_by: string | null;
          line: string;
          status: string;
          quotations: Json | null;
          recommendation: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id?: string | null;
          created_by?: string | null;
          line: string;
          status?: string;
          quotations?: Json | null;
          recommendation?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string | null;
          created_by?: string | null;
          line?: string;
          status?: string;
          quotations?: Json | null;
          recommendation?: Json | null;
          created_at?: string;
          updated_at?: string;
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
      generate_installments: {
        Args: {
          p_policy_id: string;
        };
        Returns: number;
      };
      process_overdue_invoices: {
        Args: {
          p_days_overdue?: number;
        };
        Returns: {
          processed_count: number;
          tenant_counts: Record<string, number>;
        }[];
      };
      get_client_statement: {
        Args: {
          p_tenant_id: string;
          p_client_id: string;
        };
        Returns: {
          policy_id: string;
          policy_number: string;
          insurer: string;
          line: string;
          invoices: Record<string, unknown>[];
          total_amount: number;
          total_paid: number;
          total_pending: number;
        }[];
      };
      get_commissions_by_period: {
        Args: {
          p_tenant_id: string;
          p_period_month?: string | null;
          p_agent_id?: string | null;
        };
        Returns: {
          id: string;
          policy_id: string;
          policy_number: string;
          client_name: string;
          insurer: string;
          line: string;
          agent_id: string | null;
          agent_name: string | null;
          amount: number;
          rate_pct: number;
          status: string;
          period_month: string;
          paid_at: string | null;
          premium: number;
        }[];
      };
      get_commissions_summary: {
        Args: {
          p_tenant_id: string;
          p_period_month?: string | null;
        };
        Returns: {
          total_pending: number;
          total_collected: number;
          total_void: number;
          count_pending: number;
          count_collected: number;
          count_void: number;
        }[];
      };
      get_automations_with_stats: {
        Args: {
          p_tenant_id: string;
        };
        Returns: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          trigger_event: string;
          conditions: Record<string, unknown>[];
          created_at: string;
          updated_at: string;
          actions_count: number;
          last_execution_at: string | null;
          last_execution_status: string | null;
          total_executions: number;
          successful_executions: number;
          failed_executions: number;
        }[];
      };
      get_unread_notifications_count: {
        Args: {
          p_user_id: string;
        };
        Returns: number;
      };
      mark_all_notifications_read: {
        Args: {
          p_user_id: string;
        };
        Returns: number;
      };
      // Portal M07 Functions
      get_portal_client_by_email: {
        Args: {
          p_tenant_slug: string;
          p_email: string;
        };
        Returns: {
          client_id: string;
          client_name: string;
          tenant_id: string;
          tenant_name: string;
          agent_id: string | null;
        }[];
      };
      get_portal_summary: {
        Args: {
          p_tenant_id: string;
          p_client_id: string;
        };
        Returns: {
          active_policies_count: number;
          next_renewal: string | null;
          active_claims_count: number;
          pending_invoices_count: number;
          unread_messages_count: number;
        }[];
      };
      register_portal_session: {
        Args: {
          p_tenant_id: string;
          p_client_id: string;
          p_auth_user_id: string;
          p_device_info?: Record<string, unknown>;
        };
        Returns: string;
      };
      update_portal_session_activity: {
        Args: {
          p_auth_user_id: string;
        };
        Returns: void;
      };
      is_agent_online: {
        Args: {
          p_tenant_id: string;
          p_agent_id: string;
        };
        Returns: boolean;
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
      invoice_status: 'pending' | 'paid' | 'overdue' | 'waived';
      payment_frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
      commission_status: 'pending' | 'collected' | 'void';
      automation_trigger_event: 'policy.expiring' | 'policy.activated' | 'invoice.overdue' | 'claim.created' | 'claim.status_changed' | 'opportunity.stage_changed' | 'client.created';
      automation_action_type: 'send_email' | 'create_task' | 'in_app_notification' | 'move_pipeline_stage';
      automation_queue_status: 'pending' | 'processing' | 'done' | 'error';
      automation_log_status: 'success' | 'error';
      // Portal M07 Enums
      message_sender_role: 'client' | 'agent';
      client_request_type: 'new_claim' | 'info_request' | 'complaint';
      client_request_status: 'open' | 'closed';
      // Super Admin M11 Enums
      prompt_status: 'active' | 'draft' | 'deprecated';
    };
  };
};
