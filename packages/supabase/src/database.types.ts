export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ab_test_results: {
        Row: {
          converted: boolean | null
          flag_key: string
          id: string
          metric_name: string
          metric_value: number | null
          recorded_at: string | null
          user_id: string | null
          variant: string
        }
        Insert: {
          converted?: boolean | null
          flag_key: string
          id?: string
          metric_name: string
          metric_value?: number | null
          recorded_at?: string | null
          user_id?: string | null
          variant: string
        }
        Update: {
          converted?: boolean | null
          flag_key?: string
          id?: string
          metric_name?: string
          metric_value?: number | null
          recorded_at?: string | null
          user_id?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      access_logs: {
        Row: {
          access_granted: boolean | null
          access_type: string
          alcohol_tested: string
          badge_id: string | null
          denial_reason: string | null
          department_id: string | null
          device_id: string | null
          direction: string
          gate_location: string
          id: string
          operator: string | null
          scanned_at: string | null
        }
        Insert: {
          access_granted?: boolean | null
          access_type: string
          alcohol_tested?: string
          badge_id?: string | null
          denial_reason?: string | null
          department_id?: string | null
          device_id?: string | null
          direction: string
          gate_location: string
          id?: string
          operator?: string | null
          scanned_at?: string | null
        }
        Update: {
          access_granted?: boolean | null
          access_type?: string
          alcohol_tested?: string
          badge_id?: string | null
          denial_reason?: string | null
          department_id?: string | null
          device_id?: string | null
          direction?: string
          gate_location?: string
          id?: string
          operator?: string | null
          scanned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      ai_token_usage: {
        Row: {
          cached_prompt_tokens: number
          completion_cost_usd_cents: number
          completion_tokens: number
          created_at: string | null
          department_id: string | null
          endpoint_path: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          model_name: string
          model_provider: string
          operation_type: string | null
          prompt_cost_usd_cents: number
          prompt_tokens: number
          request_id: string
          status: string
          total_cost_usd_cents: number
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          cached_prompt_tokens?: number
          completion_cost_usd_cents?: number
          completion_tokens?: number
          created_at?: string | null
          department_id?: string | null
          endpoint_path?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model_name: string
          model_provider?: string
          operation_type?: string | null
          prompt_cost_usd_cents?: number
          prompt_tokens?: number
          request_id: string
          status?: string
          total_cost_usd_cents?: number
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          cached_prompt_tokens?: number
          completion_cost_usd_cents?: number
          completion_tokens?: number
          created_at?: string | null
          department_id?: string | null
          endpoint_path?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model_name?: string
          model_provider?: string
          operation_type?: string | null
          prompt_cost_usd_cents?: number
          prompt_tokens?: number
          request_id?: string
          status?: string
          total_cost_usd_cents?: number
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_usage_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_token_usage_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      ancillary_shift_logs: {
        Row: {
          activity_notes: string | null
          activity_type: string
          created_at: string | null
          department_id: string
          fuel_liters: number | null
          id: string
          machine_id: string
          shift_date: string
          shift_type: string
          site_code: string
          trip_loads: number | null
        }
        Insert: {
          activity_notes?: string | null
          activity_type: string
          created_at?: string | null
          department_id: string
          fuel_liters?: number | null
          id?: string
          machine_id: string
          shift_date: string
          shift_type: string
          site_code: string
          trip_loads?: number | null
        }
        Update: {
          activity_notes?: string | null
          activity_type?: string
          created_at?: string | null
          department_id?: string
          fuel_liters?: number | null
          id?: string
          machine_id?: string
          shift_date?: string
          shift_type?: string
          site_code?: string
          trip_loads?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ancillary_shift_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ancillary_shift_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "ancillary_shift_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "ancillary_shift_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          department_id: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          performed_by: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          department_id?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          department_id?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          performed_by?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          department_id: string | null
          entity_type: string
          equipment_id: string | null
          expires_at: string | null
          fleet_id: string | null
          id: string
          is_active: boolean | null
          issued_at: string | null
          personnel_id: string | null
          qr_code: string
          revoked_at: string | null
          rfid_code: string | null
          visitor_id: string | null
        }
        Insert: {
          department_id?: string | null
          entity_type: string
          equipment_id?: string | null
          expires_at?: string | null
          fleet_id?: string | null
          id?: string
          is_active?: boolean | null
          issued_at?: string | null
          personnel_id?: string | null
          qr_code: string
          revoked_at?: string | null
          rfid_code?: string | null
          visitor_id?: string | null
        }
        Update: {
          department_id?: string | null
          entity_type?: string
          equipment_id?: string | null
          expires_at?: string | null
          fleet_id?: string | null
          id?: string
          is_active?: boolean | null
          issued_at?: string | null
          personnel_id?: string | null
          qr_code?: string
          revoked_at?: string | null
          rfid_code?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badges_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "badges_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      breakdowns: {
        Row: {
          completed_by: string | null
          created_at: string
          created_by: string | null
          date_in: string
          date_out: string | null
          delay_hours: number | null
          deleted_at: string | null
          department_id: string
          duration_hours: number | null
          duration_minutes: number | null
          fleet_id: string
          id: string
          idempotency_key: string | null
          is_operational_defect: boolean | null
          last_synced_at: string | null
          machine_id: string | null
          machine_name: string | null
          machine_type: string
          missing_book_in: boolean
          photo_url: string | null
          reason: string
          repair_notes: string | null
          shared_with_departments: Json | null
          shift_type: string | null
          site_code: string | null
          status: string
          sync_status: string | null
          time_in: string | null
          time_out: string | null
          updated_at: string
        }
        Insert: {
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          date_in: string
          date_out?: string | null
          delay_hours?: number | null
          deleted_at?: string | null
          department_id: string
          duration_hours?: number | null
          duration_minutes?: number | null
          fleet_id: string
          id?: string
          idempotency_key?: string | null
          is_operational_defect?: boolean | null
          last_synced_at?: string | null
          machine_id?: string | null
          machine_name?: string | null
          machine_type: string
          missing_book_in?: boolean
          photo_url?: string | null
          reason: string
          repair_notes?: string | null
          shared_with_departments?: Json | null
          shift_type?: string | null
          site_code?: string | null
          status?: string
          sync_status?: string | null
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
        }
        Update: {
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          date_in?: string
          date_out?: string | null
          delay_hours?: number | null
          deleted_at?: string | null
          department_id?: string
          duration_hours?: number | null
          duration_minutes?: number | null
          fleet_id?: string
          id?: string
          idempotency_key?: string | null
          is_operational_defect?: boolean | null
          last_synced_at?: string | null
          machine_id?: string | null
          machine_name?: string | null
          machine_type?: string
          missing_book_in?: boolean
          photo_url?: string | null
          reason?: string
          repair_notes?: string | null
          shared_with_departments?: Json | null
          shift_type?: string | null
          site_code?: string | null
          status?: string
          sync_status?: string | null
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breakdowns_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breakdowns_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "breakdowns_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "breakdowns_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      cache_anomalies: {
        Row: {
          details: Json | null
          id: number
          severity: string
          timestamp: string
          type: string
        }
        Insert: {
          details?: Json | null
          id?: number
          severity: string
          timestamp?: string
          type: string
        }
        Update: {
          details?: Json | null
          id?: number
          severity?: string
          timestamp?: string
          type?: string
        }
        Relationships: []
      }
      cache_events: {
        Row: {
          details: Json | null
          event: string
          id: number
          latency_ms: number | null
          source: string | null
          timestamp: string
        }
        Insert: {
          details?: Json | null
          event: string
          id?: number
          latency_ms?: number | null
          source?: string | null
          timestamp?: string
        }
        Update: {
          details?: Json | null
          event?: string
          id?: number
          latency_ms?: number | null
          source?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      card_printers: {
        Row: {
          connection_type: string
          created_at: string | null
          cups_name: string
          deleted_at: string | null
          device_path: string | null
          id: string
          last_online_at: string | null
          model: string
          name: string
          product_id: string | null
          status: string
          status_message: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          connection_type?: string
          created_at?: string | null
          cups_name: string
          deleted_at?: string | null
          device_path?: string | null
          id?: string
          last_online_at?: string | null
          model?: string
          name: string
          product_id?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          connection_type?: string
          created_at?: string | null
          cups_name?: string
          deleted_at?: string | null
          device_path?: string | null
          id?: string
          last_online_at?: string | null
          model?: string
          name?: string
          product_id?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: []
      }
      card_templates: {
        Row: {
          background: string | null
          created_at: string | null
          default_expiry_days: number | null
          deleted_at: string | null
          description: string | null
          fields: string[]
          id: string
          is_default: boolean | null
          layout: Json
          name: string
          updated_at: string | null
        }
        Insert: {
          background?: string | null
          created_at?: string | null
          default_expiry_days?: number | null
          deleted_at?: string | null
          description?: string | null
          fields?: string[]
          id?: string
          is_default?: boolean | null
          layout?: Json
          name: string
          updated_at?: string | null
        }
        Update: {
          background?: string | null
          created_at?: string | null
          default_expiry_days?: number | null
          deleted_at?: string | null
          description?: string | null
          fields?: string[]
          id?: string
          is_default?: boolean | null
          layout?: Json
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      compliance_audit_runs: {
        Row: {
          audit_type: string
          created_at: string
          details: Json
          executed_by: string | null
          id: string
          score: number
          status: string
          updated_at: string
        }
        Insert: {
          audit_type: string
          created_at?: string
          details?: Json
          executed_by?: string | null
          id?: string
          score?: number
          status?: string
          updated_at?: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          details?: Json
          executed_by?: string | null
          id?: string
          score?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      control_room_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          next_attempt_at: string
          payload: Json
          status: Database["public"]["Enums"]["outbox_status"]
          target: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          next_attempt_at?: string
          payload: Json
          status?: Database["public"]["Enums"]["outbox_status"]
          target: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          next_attempt_at?: string
          payload?: Json
          status?: Database["public"]["Enums"]["outbox_status"]
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      control_room_shift_reports: {
        Row: {
          alarm_response_avg_seconds: number
          approval_note: string | null
          approved_at: string | null
          approver_id: string | null
          checklist_items: Json
          completed_checklist_count: number
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          idempotency_key: string | null
          incident_ack_avg_seconds: number
          missed_incidents_count: number
          operator_name: string
          rejected_at: string | null
          report_date: string
          shift_type: string
          status: string
          submitter_id: string | null
          summary_notes: string | null
          supervisor_signature: string | null
          system_uptime_percent: number
          total_checklist_count: number
          updated_at: string
        }
        Insert: {
          alarm_response_avg_seconds?: number
          approval_note?: string | null
          approved_at?: string | null
          approver_id?: string | null
          checklist_items?: Json
          completed_checklist_count?: number
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          idempotency_key?: string | null
          incident_ack_avg_seconds?: number
          missed_incidents_count?: number
          operator_name: string
          rejected_at?: string | null
          report_date: string
          shift_type: string
          status?: string
          submitter_id?: string | null
          summary_notes?: string | null
          supervisor_signature?: string | null
          system_uptime_percent?: number
          total_checklist_count?: number
          updated_at?: string
        }
        Update: {
          alarm_response_avg_seconds?: number
          approval_note?: string | null
          approved_at?: string | null
          approver_id?: string | null
          checklist_items?: Json
          completed_checklist_count?: number
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          idempotency_key?: string | null
          incident_ack_avg_seconds?: number
          missed_incidents_count?: number
          operator_name?: string
          rejected_at?: string | null
          report_date?: string
          shift_type?: string
          status?: string
          submitter_id?: string | null
          summary_notes?: string | null
          supervisor_signature?: string | null
          system_uptime_percent?: number
          total_checklist_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_room_shift_reports_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_room_shift_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_room_shift_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_room_shift_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "control_room_shift_reports_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          idempotency_key: string | null
          last_synced_at: string | null
          log_date: string
          notes: string | null
          shift: Database["public"]["Enums"]["shift_type"]
          sync_status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          idempotency_key?: string | null
          last_synced_at?: string | null
          log_date: string
          notes?: string | null
          shift?: Database["public"]["Enums"]["shift_type"]
          sync_status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          idempotency_key?: string | null
          last_synced_at?: string | null
          log_date?: string
          notes?: string | null
          shift?: Database["public"]["Enums"]["shift_type"]
          sync_status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "daily_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      data_integrity_issues: {
        Row: {
          created_at: string
          description: string
          id: string
          issue_type: string
          record_id: string
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          table_name: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          issue_type: string
          record_id: string
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          table_name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          issue_type?: string
          record_id?: string
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_integrity_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_categories: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      delay_entries: {
        Row: {
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string | null
          delay_category_id: string
          delay_end_time: string | null
          delay_start_time: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          description: string | null
          duration_hours: number
          id: string
          is_manual_override: boolean
          machine_operation_id: string
          manual_duration_hours: number | null
          status: string
          uncommit_reason: string | null
          uncommitted_at: string | null
          uncommitted_by: string | null
          updated_at: string
        }
        Insert: {
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          delay_category_id: string
          delay_end_time?: string | null
          delay_start_time: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          duration_hours?: number
          id?: string
          is_manual_override?: boolean
          machine_operation_id: string
          manual_duration_hours?: number | null
          status?: string
          uncommit_reason?: string | null
          uncommitted_at?: string | null
          uncommitted_by?: string | null
          updated_at?: string
        }
        Update: {
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          delay_category_id?: string
          delay_end_time?: string | null
          delay_start_time?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          duration_hours?: number
          id?: string
          is_manual_override?: boolean
          machine_operation_id?: string
          manual_duration_hours?: number | null
          status?: string
          uncommit_reason?: string | null
          uncommitted_at?: string | null
          uncommitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delay_entries_committed_by_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_entries_delay_category_id_fkey"
            columns: ["delay_category_id"]
            isOneToOne: false
            referencedRelation: "delay_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_entries_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_entries_machine_operation_id_fkey"
            columns: ["machine_operation_id"]
            isOneToOne: false
            referencedRelation: "machine_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_entries_machine_operation_id_fkey"
            columns: ["machine_operation_id"]
            isOneToOne: false
            referencedRelation: "machine_operations_with_delays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_entries_uncommitted_by_fkey"
            columns: ["uncommitted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_entries_archive: {
        Row: {
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string | null
          delay_category_id: string
          delay_end_time: string | null
          delay_start_time: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          description: string | null
          duration_hours: number
          id: string
          is_manual_override: boolean
          machine_operation_id: string
          manual_duration_hours: number | null
          status: string
          uncommit_reason: string | null
          uncommitted_at: string | null
          uncommitted_by: string | null
          updated_at: string
        }
        Insert: {
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          delay_category_id: string
          delay_end_time?: string | null
          delay_start_time: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          duration_hours?: number
          id?: string
          is_manual_override?: boolean
          machine_operation_id: string
          manual_duration_hours?: number | null
          status?: string
          uncommit_reason?: string | null
          uncommitted_at?: string | null
          uncommitted_by?: string | null
          updated_at?: string
        }
        Update: {
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          delay_category_id?: string
          delay_end_time?: string | null
          delay_start_time?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          duration_hours?: number
          id?: string
          is_manual_override?: boolean
          machine_operation_id?: string
          manual_duration_hours?: number | null
          status?: string
          uncommit_reason?: string | null
          uncommitted_at?: string | null
          uncommitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          description: string | null
          display_name: string
          icon: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name: string
          icon: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      dozer_rollover_logs: {
        Row: {
          calculated_hours: number | null
          created_at: string | null
          department_id: string
          end_smu: number
          id: string
          machine_id: string
          operator_name: string | null
          push_factor_bcm_per_hour: number
          shift_date: string
          shift_type: string
          site_code: string
          start_smu: number
          total_bcm: number | null
        }
        Insert: {
          calculated_hours?: number | null
          created_at?: string | null
          department_id: string
          end_smu: number
          id?: string
          machine_id: string
          operator_name?: string | null
          push_factor_bcm_per_hour?: number
          shift_date: string
          shift_type: string
          site_code?: string
          start_smu: number
          total_bcm?: number | null
        }
        Update: {
          calculated_hours?: number | null
          created_at?: string | null
          department_id?: string
          end_smu?: number
          id?: string
          machine_id?: string
          operator_name?: string | null
          push_factor_bcm_per_hour?: number
          shift_date?: string
          shift_type?: string
          site_code?: string
          start_smu?: number
          total_bcm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dozer_rollover_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dozer_rollover_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "dozer_rollover_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "dozer_rollover_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      dozer_rolls: {
        Row: {
          area_covered_sqm: number | null
          blade_passes: number
          created_at: string
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          hours_operated: number | null
          id: string
          machine_id: string
          material_moved_tonnes: number | null
          notes: string | null
          operator_id: string | null
          push_count: number
          roll_date: string
          shift_type: string
          updated_at: string
        }
        Insert: {
          area_covered_sqm?: number | null
          blade_passes?: number
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id: string
          hours_operated?: number | null
          id?: string
          machine_id: string
          material_moved_tonnes?: number | null
          notes?: string | null
          operator_id?: string | null
          push_count?: number
          roll_date: string
          shift_type: string
          updated_at?: string
        }
        Update: {
          area_covered_sqm?: number | null
          blade_passes?: number
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id?: string
          hours_operated?: number | null
          id?: string
          machine_id?: string
          material_moved_tonnes?: number | null
          notes?: string | null
          operator_id?: string | null
          push_count?: number
          roll_date?: string
          shift_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dozer_rolls_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dozer_rolls_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "dozer_rolls_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "dozer_rolls_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dozer_rolls_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dozer_rolls_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dozer_rolls_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
        ]
      }
      dozer_rolls_archive: {
        Row: {
          area_covered_sqm: number | null
          blade_passes: number
          created_at: string
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          hours_operated: number | null
          id: string
          machine_id: string
          material_moved_tonnes: number | null
          notes: string | null
          operator_id: string | null
          push_count: number
          roll_date: string
          shift_type: string
          updated_at: string
        }
        Insert: {
          area_covered_sqm?: number | null
          blade_passes?: number
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id: string
          hours_operated?: number | null
          id?: string
          machine_id: string
          material_moved_tonnes?: number | null
          notes?: string | null
          operator_id?: string | null
          push_count?: number
          roll_date: string
          shift_type: string
          updated_at?: string
        }
        Update: {
          area_covered_sqm?: number | null
          blade_passes?: number
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id?: string
          hours_operated?: number | null
          id?: string
          machine_id?: string
          material_moved_tonnes?: number | null
          notes?: string | null
          operator_id?: string | null
          push_count?: number
          roll_date?: string
          shift_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      drill_operations: {
        Row: {
          block_drilled: string | null
          close_hours: number | null
          comments: string | null
          created_at: string
          created_by: string | null
          department_id: string
          engineering_delays: number | null
          engineering_delays_minutes: number | null
          external_delays_minutes: number | null
          holes: number | null
          id: string
          machine_id: string
          meters_drilled: number | null
          non_productional_delays: number | null
          notes: string | null
          open_hours: number | null
          operation_date: string
          operator_id: string | null
          operator_name: string | null
          production_delays: number | null
          production_delays_minutes: number | null
          shift_id: string | null
          shift_type: string | null
          site: string | null
          standard_delays_hours: number | null
          status: string | null
          total_hours: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block_drilled?: string | null
          close_hours?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          engineering_delays?: number | null
          engineering_delays_minutes?: number | null
          external_delays_minutes?: number | null
          holes?: number | null
          id?: string
          machine_id: string
          meters_drilled?: number | null
          non_productional_delays?: number | null
          notes?: string | null
          open_hours?: number | null
          operation_date?: string
          operator_id?: string | null
          operator_name?: string | null
          production_delays?: number | null
          production_delays_minutes?: number | null
          shift_id?: string | null
          shift_type?: string | null
          site?: string | null
          standard_delays_hours?: number | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block_drilled?: string | null
          close_hours?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          engineering_delays?: number | null
          engineering_delays_minutes?: number | null
          external_delays_minutes?: number | null
          holes?: number | null
          id?: string
          machine_id?: string
          meters_drilled?: number | null
          non_productional_delays?: number | null
          notes?: string | null
          open_hours?: number | null
          operation_date?: string
          operator_id?: string | null
          operator_name?: string | null
          production_delays?: number | null
          production_delays_minutes?: number | null
          shift_id?: string | null
          shift_type?: string | null
          site?: string | null
          standard_delays_hours?: number | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_operations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_operations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "drill_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "drill_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_operations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_operations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_status"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_operations_archive: {
        Row: {
          block_drilled: string | null
          close_hours: number | null
          comments: string | null
          created_at: string
          created_by: string | null
          department_id: string
          engineering_delays: number | null
          engineering_delays_minutes: number | null
          external_delays_minutes: number | null
          holes: number | null
          id: string
          machine_id: string
          meters_drilled: number | null
          non_productional_delays: number | null
          notes: string | null
          open_hours: number | null
          operation_date: string
          operator_id: string | null
          operator_name: string | null
          production_delays: number | null
          production_delays_minutes: number | null
          shift_id: string | null
          shift_type: string | null
          site: string | null
          standard_delays_hours: number | null
          status: string | null
          total_hours: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block_drilled?: string | null
          close_hours?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          engineering_delays?: number | null
          engineering_delays_minutes?: number | null
          external_delays_minutes?: number | null
          holes?: number | null
          id?: string
          machine_id: string
          meters_drilled?: number | null
          non_productional_delays?: number | null
          notes?: string | null
          open_hours?: number | null
          operation_date?: string
          operator_id?: string | null
          operator_name?: string | null
          production_delays?: number | null
          production_delays_minutes?: number | null
          shift_id?: string | null
          shift_type?: string | null
          site?: string | null
          standard_delays_hours?: number | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block_drilled?: string | null
          close_hours?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          engineering_delays?: number | null
          engineering_delays_minutes?: number | null
          external_delays_minutes?: number | null
          holes?: number | null
          id?: string
          machine_id?: string
          meters_drilled?: number | null
          non_productional_delays?: number | null
          notes?: string | null
          open_hours?: number | null
          operation_date?: string
          operator_id?: string | null
          operator_name?: string | null
          production_delays?: number | null
          production_delays_minutes?: number | null
          shift_id?: string | null
          shift_type?: string | null
          site?: string | null
          standard_delays_hours?: number | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      embedding_cache: {
        Row: {
          created_at: string
          embedding: string
          text_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding: string
          text_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string
          text_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_department_access: {
        Row: {
          access_level: Database["public"]["Enums"]["department_access_level"]
          created_at: string
          department_id: string
          employee_id: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["department_access_level"]
          created_at?: string
          department_id: string
          employee_id: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["department_access_level"]
          created_at?: string
          department_id?: string
          employee_id?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_department_access_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_department_access_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "employee_department_access_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_department_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          accessible_departments: string[] | null
          areas: string[] | null
          auth_id: string
          created_at: string
          deleted_at: string | null
          department_id: string | null
          employee_code: string | null
          first_name: string | null
          full_name: string
          id: string
          induction_expiry_date: string | null
          job_title: string | null
          last_name: string | null
          medical_expiry_date: string | null
          national_id: string | null
          photo_url: string | null
          pin_hash: string | null
          qr_code_data: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          accessible_departments?: string[] | null
          areas?: string[] | null
          auth_id: string
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          employee_code?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          induction_expiry_date?: string | null
          job_title?: string | null
          last_name?: string | null
          medical_expiry_date?: string | null
          national_id?: string | null
          photo_url?: string | null
          pin_hash?: string | null
          qr_code_data?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          accessible_departments?: string[] | null
          areas?: string[] | null
          auth_id?: string
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          employee_code?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          induction_expiry_date?: string | null
          job_title?: string | null
          last_name?: string | null
          medical_expiry_date?: string | null
          national_id?: string | null
          photo_url?: string | null
          pin_hash?: string | null
          qr_code_data?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      engineering_notes: {
        Row: {
          action_taken: string
          created_at: string
          created_by: string | null
          department_id: string
          description: string
          id: string
          issue_type: string
          machine_id: string | null
          note_date: string
          requires_follow_up: boolean
          resolved_at: string | null
          severity: string
          shift_type: string
          status: string
          updated_at: string
        }
        Insert: {
          action_taken: string
          created_at?: string
          created_by?: string | null
          department_id: string
          description: string
          id?: string
          issue_type: string
          machine_id?: string | null
          note_date: string
          requires_follow_up?: boolean
          resolved_at?: string | null
          severity: string
          shift_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string
          id?: string
          issue_type?: string
          machine_id?: string | null
          note_date?: string
          requires_follow_up?: boolean
          resolved_at?: string | null
          severity?: string
          shift_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineering_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineering_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineering_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "engineering_notes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "engineering_notes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      engineering_notes_archive: {
        Row: {
          action_taken: string
          created_at: string
          created_by: string | null
          department_id: string
          description: string
          id: string
          issue_type: string
          machine_id: string | null
          note_date: string
          requires_follow_up: boolean
          resolved_at: string | null
          severity: string
          shift_type: string
          status: string
          updated_at: string
        }
        Insert: {
          action_taken: string
          created_at?: string
          created_by?: string | null
          department_id: string
          description: string
          id?: string
          issue_type: string
          machine_id?: string | null
          note_date: string
          requires_follow_up?: boolean
          resolved_at?: string | null
          severity: string
          shift_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string
          id?: string
          issue_type?: string
          machine_id?: string | null
          note_date?: string
          requires_follow_up?: boolean
          resolved_at?: string | null
          severity?: string
          shift_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          assigned_to: string | null
          calibration_expiry: string | null
          created_at: string | null
          department_id: string | null
          equip_code: string
          equipment_type: string
          id: string
          manufacturer: string | null
          model: string | null
          serial_number: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          calibration_expiry?: string | null
          created_at?: string | null
          department_id?: string | null
          equip_code: string
          equipment_type: string
          id?: string
          manufacturer?: string | null
          model?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          calibration_expiry?: string | null
          created_at?: string | null
          department_id?: string | null
          equip_code?: string
          equipment_type?: string
          id?: string
          manufacturer?: string | null
          model?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      excavator_activity: {
        Row: {
          activity_date: string
          avg_cycle_time_seconds: number | null
          block_mined_id: string | null
          created_at: string
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          estimated_tonnes: number | null
          id: string
          loads: number
          machine_id: string
          material_type: string | null
          notes: string | null
          operator_id: string | null
          passes: number
          shift_type: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          activity_date: string
          avg_cycle_time_seconds?: number | null
          block_mined_id?: string | null
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id: string
          estimated_tonnes?: number | null
          id?: string
          loads?: number
          machine_id: string
          material_type?: string | null
          notes?: string | null
          operator_id?: string | null
          passes?: number
          shift_type: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_date?: string
          avg_cycle_time_seconds?: number | null
          block_mined_id?: string | null
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id?: string
          estimated_tonnes?: number | null
          id?: string
          loads?: number
          machine_id?: string
          material_type?: string | null
          notes?: string | null
          operator_id?: string | null
          passes?: number
          shift_type?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excavator_activity_block_mined_id_fkey"
            columns: ["block_mined_id"]
            isOneToOne: false
            referencedRelation: "mine_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excavator_activity_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excavator_activity_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "excavator_activity_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "excavator_activity_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excavator_activity_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excavator_activity_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_excavator_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_excavator_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
        ]
      }
      excavator_activity_archive: {
        Row: {
          activity_date: string
          avg_cycle_time_seconds: number | null
          block_mined_id: string | null
          created_at: string
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          estimated_tonnes: number | null
          id: string
          loads: number
          machine_id: string
          material_type: string | null
          notes: string | null
          operator_id: string | null
          passes: number
          shift_type: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          activity_date: string
          avg_cycle_time_seconds?: number | null
          block_mined_id?: string | null
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id: string
          estimated_tonnes?: number | null
          id?: string
          loads?: number
          machine_id: string
          material_type?: string | null
          notes?: string | null
          operator_id?: string | null
          passes?: number
          shift_type: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_date?: string
          avg_cycle_time_seconds?: number | null
          block_mined_id?: string | null
          created_at?: string
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id?: string
          estimated_tonnes?: number | null
          id?: string
          loads?: number
          machine_id?: string
          material_type?: string | null
          notes?: string | null
          operator_id?: string | null
          passes?: number
          shift_type?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      excavator_dumper_assignments: {
        Row: {
          created_at: string
          dumper_machine_id: string
          excavator_activity_id: string
          id: string
          material_type: string
          notes: string | null
          total_bcm: number | null
          total_loads: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dumper_machine_id: string
          excavator_activity_id: string
          id?: string
          material_type?: string
          notes?: string | null
          total_bcm?: number | null
          total_loads?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dumper_machine_id?: string
          excavator_activity_id?: string
          id?: string
          material_type?: string
          notes?: string | null
          total_bcm?: number | null
          total_loads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excavator_dumper_assignments_dumper_machine_id_fkey"
            columns: ["dumper_machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "excavator_dumper_assignments_dumper_machine_id_fkey"
            columns: ["dumper_machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excavator_dumper_assignments_excavator_activity_id_fkey"
            columns: ["excavator_activity_id"]
            isOneToOne: false
            referencedRelation: "excavator_activity"
            referencedColumns: ["id"]
          },
        ]
      }
      excavator_dumper_assignments_archive: {
        Row: {
          created_at: string
          dumper_machine_id: string
          excavator_activity_id: string
          id: string
          material_type: string
          notes: string | null
          total_bcm: number | null
          total_loads: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dumper_machine_id: string
          excavator_activity_id: string
          id?: string
          material_type?: string
          notes?: string | null
          total_bcm?: number | null
          total_loads?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dumper_machine_id?: string
          excavator_activity_id?: string
          id?: string
          material_type?: string
          notes?: string | null
          total_bcm?: number | null
          total_loads?: number
          updated_at?: string
        }
        Relationships: []
      }
      excavator_haul_logs: {
        Row: {
          block_id: string
          created_at: string | null
          delays_text: string | null
          department_id: string
          excavator_id: string
          id: string
          material_type: string
          operating_hours: number
          operator_name: string
          shift_date: string
          shift_type: string
          site_code: string
        }
        Insert: {
          block_id: string
          created_at?: string | null
          delays_text?: string | null
          department_id: string
          excavator_id: string
          id?: string
          material_type: string
          operating_hours?: number
          operator_name: string
          shift_date: string
          shift_type: string
          site_code?: string
        }
        Update: {
          block_id?: string
          created_at?: string | null
          delays_text?: string | null
          department_id?: string
          excavator_id?: string
          id?: string
          material_type?: string
          operating_hours?: number
          operator_name?: string
          shift_date?: string
          shift_type?: string
          site_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "excavator_haul_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excavator_haul_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "excavator_haul_logs_excavator_id_fkey"
            columns: ["excavator_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "excavator_haul_logs_excavator_id_fkey"
            columns: ["excavator_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      excavator_truck_tallies: {
        Row: {
          bcm_per_load: number | null
          haul_log_id: string
          id: string
          load_count: number
          tonnes_per_load: number | null
          truck_id: string
          truck_name: string
        }
        Insert: {
          bcm_per_load?: number | null
          haul_log_id: string
          id?: string
          load_count?: number
          tonnes_per_load?: number | null
          truck_id: string
          truck_name: string
        }
        Update: {
          bcm_per_load?: number | null
          haul_log_id?: string
          id?: string
          load_count?: number
          tonnes_per_load?: number | null
          truck_id?: string
          truck_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "excavator_truck_tallies_haul_log_id_fkey"
            columns: ["haul_log_id"]
            isOneToOne: false
            referencedRelation: "excavator_haul_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excavator_truck_tallies_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "excavator_truck_tallies_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_exposures: {
        Row: {
          evaluated_at: string | null
          flag_key: string
          id: string
          metadata: Json | null
          session_id: string | null
          user_id: string | null
          variant: string
        }
        Insert: {
          evaluated_at?: string | null
          flag_key: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
          variant: string
        }
        Update: {
          evaluated_at?: string | null
          flag_key?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_exposures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          end_date: string | null
          id: string
          key: string
          name: string
          rollout_percentage: number | null
          start_date: string | null
          target_groups: Json | null
          target_users: Json | null
          updated_at: string | null
          variant_a: Json | null
          variant_b: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          end_date?: string | null
          id?: string
          key: string
          name: string
          rollout_percentage?: number | null
          start_date?: string | null
          target_groups?: Json | null
          target_users?: Json | null
          updated_at?: string | null
          variant_a?: Json | null
          variant_b?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          end_date?: string | null
          id?: string
          key?: string
          name?: string
          rollout_percentage?: number | null
          start_date?: string | null
          target_groups?: Json | null
          target_users?: Json | null
          updated_at?: string | null
          variant_a?: Json | null
          variant_b?: Json | null
        }
        Relationships: []
      }
      fleet: {
        Row: {
          created_at: string | null
          department_id: string | null
          fleet_code: string
          id: string
          last_service_date: string | null
          make: string | null
          model: string | null
          next_service_date: string | null
          registration_number: string | null
          status: string
          updated_at: string | null
          vehicle_type: string
          year: number | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          fleet_code: string
          id?: string
          last_service_date?: string | null
          make?: string | null
          model?: string | null
          next_service_date?: string | null
          registration_number?: string | null
          status?: string
          updated_at?: string | null
          vehicle_type: string
          year?: number | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          fleet_code?: string
          id?: string
          last_service_date?: string | null
          make?: string | null
          model?: string | null
          next_service_date?: string | null
          registration_number?: string | null
          status?: string
          updated_at?: string | null
          vehicle_type?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          created_at: string
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string
          diesel_litres: number
          id: string
          machine_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id: string
          diesel_litres?: number
          id?: string
          machine_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string
          diesel_litres?: number
          id?: string
          machine_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_fuel_logs_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fuel_logs_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "fuel_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "fuel_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          department_id: string
          generated_at: string
          generated_by: string
          id: string
          pdf_url: string | null
          report_data: Json
          report_date: string
          shift_type: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          department_id: string
          generated_at?: string
          generated_by: string
          id?: string
          pdf_url?: string | null
          report_data: Json
          report_date: string
          shift_type?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          department_id?: string
          generated_at?: string
          generated_by?: string
          id?: string
          pdf_url?: string | null
          report_data?: Json
          report_date?: string
          shift_type?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "generated_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_loads: {
        Row: {
          created_at: string
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          end_hour: number
          excavator_id: string | null
          hour_01: number
          hour_02: number
          hour_03: number
          hour_04: number
          hour_05: number
          hour_06: number
          hour_07: number
          hour_08: number
          hour_09: number
          hour_10: number
          hour_11: number
          hour_12: number
          id: string
          is_locked: boolean
          load_date: string
          machine_id: string
          material_type: string
          shift_type: string
          start_hour: number
          total_loads: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id: string
          end_hour?: number
          excavator_id?: string | null
          hour_01?: number
          hour_02?: number
          hour_03?: number
          hour_04?: number
          hour_05?: number
          hour_06?: number
          hour_07?: number
          hour_08?: number
          hour_09?: number
          hour_10?: number
          hour_11?: number
          hour_12?: number
          id?: string
          is_locked?: boolean
          load_date: string
          machine_id: string
          material_type?: string
          shift_type: string
          start_hour?: number
          total_loads?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id?: string
          end_hour?: number
          excavator_id?: string | null
          hour_01?: number
          hour_02?: number
          hour_03?: number
          hour_04?: number
          hour_05?: number
          hour_06?: number
          hour_07?: number
          hour_08?: number
          hour_09?: number
          hour_10?: number
          hour_11?: number
          hour_12?: number
          id?: string
          is_locked?: boolean
          load_date?: string
          machine_id?: string
          material_type?: string
          shift_type?: string
          start_hour?: number
          total_loads?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hourly_loads_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hourly_loads_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "hourly_loads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_loads_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_loads_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "hourly_loads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_loads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "hourly_loads_excavator_id_fkey"
            columns: ["excavator_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "hourly_loads_excavator_id_fkey"
            columns: ["excavator_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_loads_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "hourly_loads_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_loads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          request_hash: string
          response_json: Json
          route: string
          status_code: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          request_hash: string
          response_json: Json
          route: string
          status_code: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          request_hash?: string
          response_json?: Json
          route?: string
          status_code?: number
          user_id?: string
        }
        Relationships: []
      }
      integration_audit_logs: {
        Row: {
          args_digest: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          installation_id: string | null
          invoked_by: string | null
          status: string
          tool_name: string
        }
        Insert: {
          args_digest?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          installation_id?: string | null
          invoked_by?: string | null
          status: string
          tool_name: string
        }
        Update: {
          args_digest?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          installation_id?: string | null
          invoked_by?: string | null
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_audit_logs_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "integration_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_catalog: {
        Row: {
          auth_type: string
          author: string | null
          capabilities: Json
          created_at: string
          description: string | null
          docs_url: string | null
          icon_url: string | null
          id: string
          kind: string
          name: string
          server_url: string | null
          updated_at: string | null
          verified: boolean
        }
        Insert: {
          auth_type?: string
          author?: string | null
          capabilities?: Json
          created_at?: string
          description?: string | null
          docs_url?: string | null
          icon_url?: string | null
          id: string
          kind?: string
          name: string
          server_url?: string | null
          updated_at?: string | null
          verified?: boolean
        }
        Update: {
          auth_type?: string
          author?: string | null
          capabilities?: Json
          created_at?: string
          description?: string | null
          docs_url?: string | null
          icon_url?: string | null
          id?: string
          kind?: string
          name?: string
          server_url?: string | null
          updated_at?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      integration_credentials: {
        Row: {
          ciphertext: string
          created_at: string
          expires_at: string | null
          id: string
          installation_id: string
          kind: string
          updated_at: string | null
        }
        Insert: {
          ciphertext: string
          created_at?: string
          expires_at?: string | null
          id?: string
          installation_id: string
          kind?: string
          updated_at?: string | null
        }
        Update: {
          ciphertext?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          installation_id?: string
          kind?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "integration_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_installations: {
        Row: {
          catalog_id: string
          config: Json
          created_at: string
          department_id: string | null
          id: string
          installed_by: string | null
          last_error: string | null
          scope: string
          status: string
          tool_allowlist: Json
          tool_cache: Json | null
          tools_synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          catalog_id: string
          config?: Json
          created_at?: string
          department_id?: string | null
          id?: string
          installed_by?: string | null
          last_error?: string | null
          scope?: string
          status?: string
          tool_allowlist?: Json
          tool_cache?: Json | null
          tools_synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          catalog_id?: string
          config?: Json
          created_at?: string
          department_id?: string | null
          id?: string
          installed_by?: string | null
          last_error?: string | null
          scope?: string
          status?: string
          tool_allowlist?: Json
          tool_cache?: Json | null
          tools_synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_installations_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "integration_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_installations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_installations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      issued_cards: {
        Row: {
          expires_at: string | null
          id: string
          issued_at: string | null
          lost_at: string | null
          personnel_id: string | null
          print_job_id: string | null
          qr_code_data: string
          replaced_by: string | null
          revoked_at: string | null
          revoked_reason: string | null
          rfid_uid: string | null
          status: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          lost_at?: string | null
          personnel_id?: string | null
          print_job_id?: string | null
          qr_code_data: string
          replaced_by?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          rfid_uid?: string | null
          status?: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          lost_at?: string | null
          personnel_id?: string | null
          print_job_id?: string | null
          qr_code_data?: string
          replaced_by?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          rfid_uid?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "issued_cards_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issued_cards_print_job_id_fkey"
            columns: ["print_job_id"]
            isOneToOne: true
            referencedRelation: "print_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issued_cards_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "issued_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_configurations: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          hydraulic_pressure: number
          id: string
          power_allocation: number
          target_rpm: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          hydraulic_pressure: number
          id?: string
          power_allocation: number
          target_rpm: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          hydraulic_pressure?: number
          id?: string
          power_allocation?: number
          target_rpm?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_configurations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_configurations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_configurations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "machine_configurations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_hours: {
        Row: {
          created_at: string
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string
          hours_worked: number
          id: string
          machine_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id: string
          hours_worked?: number
          id?: string
          machine_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string
          hours_worked?: number
          id?: string
          machine_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_machine_hours_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_machine_hours_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "machine_hours_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hours_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machine_hours_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_operations: {
        Row: {
          block_drilled: string | null
          created_at: string
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          end_smu: number | null
          end_time: string | null
          holes_drilled: number | null
          hours_worked: number | null
          id: string
          machine_id: string
          meters_drilled: number | null
          operational_status:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id: string | null
          operator_name: string | null
          shift_date: string
          shift_type: string
          site_code: string | null
          site_id: string | null
          start_smu: number | null
          start_time: string
          updated_at: string
        }
        Insert: {
          block_drilled?: string | null
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id: string
          end_smu?: number | null
          end_time?: string | null
          holes_drilled?: number | null
          hours_worked?: number | null
          id?: string
          machine_id: string
          meters_drilled?: number | null
          operational_status?:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id?: string | null
          operator_name?: string | null
          shift_date: string
          shift_type: string
          site_code?: string | null
          site_id?: string | null
          start_smu?: number | null
          start_time: string
          updated_at?: string
        }
        Update: {
          block_drilled?: string | null
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id?: string
          end_smu?: number | null
          end_time?: string | null
          holes_drilled?: number | null
          hours_worked?: number | null
          id?: string
          machine_id?: string
          meters_drilled?: number | null
          operational_status?:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id?: string | null
          operator_name?: string | null
          shift_date?: string
          shift_type?: string
          site_code?: string | null
          site_id?: string | null
          start_smu?: number | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_machine_ops_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_machine_ops_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "machine_operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "machine_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machine_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_operations_archive: {
        Row: {
          block_drilled: string | null
          created_at: string
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          end_smu: number | null
          end_time: string | null
          holes_drilled: number | null
          hours_worked: number | null
          id: string
          machine_id: string
          meters_drilled: number | null
          operational_status:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id: string | null
          operator_name: string | null
          shift_date: string
          shift_type: string
          site_code: string | null
          site_id: string | null
          start_smu: number | null
          start_time: string
          updated_at: string
        }
        Insert: {
          block_drilled?: string | null
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id: string
          end_smu?: number | null
          end_time?: string | null
          holes_drilled?: number | null
          hours_worked?: number | null
          id?: string
          machine_id: string
          meters_drilled?: number | null
          operational_status?:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id?: string | null
          operator_name?: string | null
          shift_date: string
          shift_type: string
          site_code?: string | null
          site_id?: string | null
          start_smu?: number | null
          start_time: string
          updated_at?: string
        }
        Update: {
          block_drilled?: string | null
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          department_id?: string
          end_smu?: number | null
          end_time?: string | null
          holes_drilled?: number | null
          hours_worked?: number | null
          id?: string
          machine_id?: string
          meters_drilled?: number | null
          operational_status?:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id?: string | null
          operator_name?: string | null
          shift_date?: string
          shift_type?: string
          site_code?: string | null
          site_id?: string | null
          start_smu?: number | null
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      machine_telemetry: {
        Row: {
          alert_codes: string[] | null
          alert_count: number | null
          ambient_temp: number | null
          bit_depth: number | null
          created_at: string
          department_id: string
          engine_rpm: number | null
          engine_temp: number | null
          fuel_level: number | null
          hole_depth: number | null
          hydraulic_pressure: number | null
          hydraulic_temp: number | null
          id: string
          machine_id: string
          mud_flow_rate: number | null
          operating_hours: number | null
          penetration_rate: number | null
          recorded_at: string
          rotation_torque: number | null
          standpipe_pressure: number | null
          vibration_level: number | null
          weight_on_bit: number | null
          year_month: string
        }
        Insert: {
          alert_codes?: string[] | null
          alert_count?: number | null
          ambient_temp?: number | null
          bit_depth?: number | null
          created_at?: string
          department_id: string
          engine_rpm?: number | null
          engine_temp?: number | null
          fuel_level?: number | null
          hole_depth?: number | null
          hydraulic_pressure?: number | null
          hydraulic_temp?: number | null
          id?: string
          machine_id: string
          mud_flow_rate?: number | null
          operating_hours?: number | null
          penetration_rate?: number | null
          recorded_at?: string
          rotation_torque?: number | null
          standpipe_pressure?: number | null
          vibration_level?: number | null
          weight_on_bit?: number | null
          year_month?: string
        }
        Update: {
          alert_codes?: string[] | null
          alert_count?: number | null
          ambient_temp?: number | null
          bit_depth?: number | null
          created_at?: string
          department_id?: string
          engine_rpm?: number | null
          engine_temp?: number | null
          fuel_level?: number | null
          hole_depth?: number | null
          hydraulic_pressure?: number | null
          hydraulic_temp?: number | null
          id?: string
          machine_id?: string
          mud_flow_rate?: number | null
          operating_hours?: number | null
          penetration_rate?: number | null
          recorded_at?: string
          rotation_torque?: number | null
          standpipe_pressure?: number | null
          vibration_level?: number | null
          weight_on_bit?: number | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_telemetry_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_telemetry_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "machine_telemetry_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machine_telemetry_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_telemetry_archive: {
        Row: {
          alert_codes: string[] | null
          alert_count: number | null
          ambient_temp: number | null
          archived_at: string
          bit_depth: number | null
          created_at: string
          department_id: string
          engine_rpm: number | null
          engine_temp: number | null
          fuel_level: number | null
          hole_depth: number | null
          hydraulic_pressure: number | null
          hydraulic_temp: number | null
          id: string
          machine_id: string
          mud_flow_rate: number | null
          operating_hours: number | null
          penetration_rate: number | null
          record_count: number
          recorded_at: string
          rotation_torque: number | null
          standpipe_pressure: number | null
          vibration_level: number | null
          weight_on_bit: number | null
          year_month: string
        }
        Insert: {
          alert_codes?: string[] | null
          alert_count?: number | null
          ambient_temp?: number | null
          archived_at?: string
          bit_depth?: number | null
          created_at?: string
          department_id: string
          engine_rpm?: number | null
          engine_temp?: number | null
          fuel_level?: number | null
          hole_depth?: number | null
          hydraulic_pressure?: number | null
          hydraulic_temp?: number | null
          id?: string
          machine_id: string
          mud_flow_rate?: number | null
          operating_hours?: number | null
          penetration_rate?: number | null
          record_count?: number
          recorded_at: string
          rotation_torque?: number | null
          standpipe_pressure?: number | null
          vibration_level?: number | null
          weight_on_bit?: number | null
          year_month: string
        }
        Update: {
          alert_codes?: string[] | null
          alert_count?: number | null
          ambient_temp?: number | null
          archived_at?: string
          bit_depth?: number | null
          created_at?: string
          department_id?: string
          engine_rpm?: number | null
          engine_temp?: number | null
          fuel_level?: number | null
          hole_depth?: number | null
          hydraulic_pressure?: number | null
          hydraulic_temp?: number | null
          id?: string
          machine_id?: string
          mud_flow_rate?: number | null
          operating_hours?: number | null
          penetration_rate?: number | null
          record_count?: number
          recorded_at?: string
          rotation_torque?: number | null
          standpipe_pressure?: number | null
          vibration_level?: number | null
          weight_on_bit?: number | null
          year_month?: string
        }
        Relationships: []
      }
      machine_types: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          requires_hourly_loads: boolean
          tracks_bench_clearance: boolean
          tracks_cycle_time: boolean
          tracks_drill_depth: boolean
          tracks_fuel: boolean
          tracks_tonnage: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          requires_hourly_loads?: boolean
          tracks_bench_clearance?: boolean
          tracks_cycle_time?: boolean
          tracks_drill_depth?: boolean
          tracks_fuel?: boolean
          tracks_tonnage?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          requires_hourly_loads?: boolean
          tracks_bench_clearance?: boolean
          tracks_cycle_time?: boolean
          tracks_drill_depth?: boolean
          tracks_fuel?: boolean
          tracks_tonnage?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          active: boolean
          bin_factor: number | null
          bin_factor_coal: number | null
          bin_factor_waste: number | null
          created_at: string
          deleted_at: string | null
          department_id: string
          id: string
          machine_type: string
          machine_type_id: string | null
          manufacturer: string | null
          name: string
          report_exempt: boolean
          serial_number: string | null
          site_id: string | null
          starting_smr: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          bin_factor?: number | null
          bin_factor_coal?: number | null
          bin_factor_waste?: number | null
          created_at?: string
          deleted_at?: string | null
          department_id: string
          id?: string
          machine_type: string
          machine_type_id?: string | null
          manufacturer?: string | null
          name: string
          report_exempt?: boolean
          serial_number?: string | null
          site_id?: string | null
          starting_smr?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          bin_factor?: number | null
          bin_factor_coal?: number | null
          bin_factor_waste?: number | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string
          id?: string
          machine_type?: string
          machine_type_id?: string | null
          manufacturer?: string | null
          name?: string
          report_exempt?: boolean
          serial_number?: string | null
          site_id?: string | null
          starting_smr?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "machines_machine_type_id_fkey"
            columns: ["machine_type_id"]
            isOneToOne: false
            referencedRelation: "machine_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      material_density: {
        Row: {
          created_at: string
          density_factor: number
          id: string
          material_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          density_factor: number
          id?: string
          material_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          density_factor?: number
          id?: string
          material_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      materialized_view_refresh_log: {
        Row: {
          error_message: string | null
          id: string
          is_concurrent: boolean | null
          metadata: Json | null
          refresh_duration_ms: number | null
          refresh_end: string | null
          refresh_start: string
          rows_affected: number | null
          status: string
          triggered_by: string | null
          view_name: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          is_concurrent?: boolean | null
          metadata?: Json | null
          refresh_duration_ms?: number | null
          refresh_end?: string | null
          refresh_start?: string
          rows_affected?: number | null
          status: string
          triggered_by?: string | null
          view_name: string
        }
        Update: {
          error_message?: string | null
          id?: string
          is_concurrent?: boolean | null
          metadata?: Json | null
          refresh_duration_ms?: number | null
          refresh_end?: string | null
          refresh_start?: string
          rows_affected?: number | null
          status?: string
          triggered_by?: string | null
          view_name?: string
        }
        Relationships: []
      }
      memory_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          memory_type: Database["public"]["Enums"]["memory_type"]
          metadata: Json
          session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: string
          memory_type?: Database["public"]["Enums"]["memory_type"]
          metadata?: Json
          session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          memory_type?: Database["public"]["Enums"]["memory_type"]
          metadata?: Json
          session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mine_blocks: {
        Row: {
          active: boolean
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          site_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          site_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          site_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mine_blocks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_machine_snapshots: {
        Row: {
          created_at: string
          department_id: string
          fleet_availability_percent: number
          fleet_utilization_percent: number
          id: string
          is_sealed: boolean
          machine_count: number
          month: string
          records: Json
          sealed_at: string
          sealed_by: string | null
          shift_type: string
          summaries: Json
          total_breakdown_hours: number
          total_smr_worked: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          fleet_availability_percent?: number
          fleet_utilization_percent?: number
          id?: string
          is_sealed?: boolean
          machine_count?: number
          month: string
          records?: Json
          sealed_at?: string
          sealed_by?: string | null
          shift_type?: string
          summaries?: Json
          total_breakdown_hours?: number
          total_smr_worked?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          fleet_availability_percent?: number
          fleet_utilization_percent?: number
          id?: string
          is_sealed?: boolean
          machine_count?: number
          month?: string
          records?: Json
          sealed_at?: string
          sealed_by?: string | null
          shift_type?: string
          summaries?: Json
          total_breakdown_hours?: number
          total_smr_worked?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_machine_snapshots_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_machine_snapshots_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "monthly_machine_snapshots_sealed_by_fkey"
            columns: ["sealed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      muster_events: {
        Row: {
          badge_code: string | null
          employee_id: string | null
          full_name: string
          id: string
          muster_point: string
          notes: string | null
          personnel_id: string | null
          recorded_at: string
          recorded_by: string | null
          status: string
        }
        Insert: {
          badge_code?: string | null
          employee_id?: string | null
          full_name: string
          id?: string
          muster_point?: string
          notes?: string | null
          personnel_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          status?: string
        }
        Update: {
          badge_code?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          muster_point?: string
          notes?: string | null
          personnel_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "muster_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muster_events_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muster_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      mutation_log: {
        Row: {
          created_at: string
          entity: string
          entity_id: string
          hlc_counter: number
          hlc_wall: number
          mutation_id: string
          node_id: string
          op: string
          payload: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          entity_id: string
          hlc_counter: number
          hlc_wall: number
          mutation_id: string
          node_id: string
          op: string
          payload: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          entity_id?: string
          hlc_counter?: number
          hlc_wall?: number
          mutation_id?: string
          node_id?: string
          op?: string
          payload?: Json
          tenant_id?: string
        }
        Relationships: []
      }
      operational_delays_deprecated_20250115: {
        Row: {
          affected_machine_id: string | null
          created_at: string
          created_by: string | null
          delay_category_id: string | null
          delay_date: string
          delay_minutes: number
          delay_type: string
          department_id: string
          description: string
          id: string
          impact_description: string
          recovery_action: string | null
          shift_type: string
          status: string
          updated_at: string
        }
        Insert: {
          affected_machine_id?: string | null
          created_at?: string
          created_by?: string | null
          delay_category_id?: string | null
          delay_date: string
          delay_minutes: number
          delay_type: string
          department_id: string
          description: string
          id?: string
          impact_description: string
          recovery_action?: string | null
          shift_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          affected_machine_id?: string | null
          created_at?: string
          created_by?: string | null
          delay_category_id?: string | null
          delay_date?: string
          delay_minutes?: number
          delay_type?: string
          department_id?: string
          description?: string
          id?: string
          impact_description?: string
          recovery_action?: string | null
          shift_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_delays_affected_machine_id_fkey"
            columns: ["affected_machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "operational_delays_affected_machine_id_fkey"
            columns: ["affected_machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_delays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_delays_delay_category_id_fkey"
            columns: ["delay_category_id"]
            isOneToOne: false
            referencedRelation: "delay_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_delays_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_delays_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      operators: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          employee_code: string
          full_name: string
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          employee_code: string
          full_name: string
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          employee_code?: string
          full_name?: string
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      personnel: {
        Row: {
          area: string | null
          created_at: string | null
          department_id: string | null
          emp_code: string
          first_name: string
          id: string
          id_number: string
          induction_expiry: string | null
          job_title: string | null
          medical_expiry: string | null
          photo_url: string | null
          status: string | null
          surname: string
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string | null
          department_id?: string | null
          emp_code: string
          first_name: string
          id?: string
          id_number: string
          induction_expiry?: string | null
          job_title?: string | null
          medical_expiry?: string | null
          photo_url?: string | null
          status?: string | null
          surname: string
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string | null
          department_id?: string | null
          emp_code?: string
          first_name?: string
          id?: string
          id_number?: string
          induction_expiry?: string | null
          job_title?: string | null
          medical_expiry?: string | null
          photo_url?: string | null
          status?: string | null
          surname?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      plant_delays: {
        Row: {
          category: string
          circuit: string
          corrective_action: string
          created_at: string
          delay_date: string
          department_id: string | null
          duration_minutes: number
          end_time: string | null
          id: string
          impact_type: string
          logged_by: string
          reason: string
          shift: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          circuit: string
          corrective_action?: string
          created_at?: string
          delay_date?: string
          department_id?: string | null
          duration_minutes?: number
          end_time?: string | null
          id?: string
          impact_type?: string
          logged_by?: string
          reason: string
          shift: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          circuit?: string
          corrective_action?: string
          created_at?: string
          delay_date?: string
          department_id?: string | null
          duration_minutes?: number
          end_time?: string | null
          id?: string
          impact_type?: string
          logged_by?: string
          reason?: string
          shift?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_delays_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_delays_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      plant_hourly_logs: {
        Row: {
          avg_yield_pct: number
          created_at: string
          department_id: string | null
          id: string
          module_id: string
          operation_date: string
          operator_name: string
          rows: Json
          shift: string
          total_clean_coal_tonnes: number
          total_discard_tonnes: number
          total_rom_tonnes: number
          updated_at: string
        }
        Insert: {
          avg_yield_pct?: number
          created_at?: string
          department_id?: string | null
          id?: string
          module_id?: string
          operation_date: string
          operator_name?: string
          rows?: Json
          shift: string
          total_clean_coal_tonnes?: number
          total_discard_tonnes?: number
          total_rom_tonnes?: number
          updated_at?: string
        }
        Update: {
          avg_yield_pct?: number
          created_at?: string
          department_id?: string | null
          id?: string
          module_id?: string
          operation_date?: string
          operator_name?: string
          rows?: Json
          shift?: string
          total_clean_coal_tonnes?: number
          total_discard_tonnes?: number
          total_rom_tonnes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_hourly_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_hourly_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      plant_inventory_items: {
        Row: {
          amount_present: number
          amount_required: number
          category: string
          code: string
          coverage_pct: number | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string
          id: string
          needs_replenishment: boolean | null
          plant_equipment: string
          shortfall_amount: number | null
          stock: string
          stock_status: string | null
          surplus_amount: number | null
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_present?: number
          amount_required?: number
          category: string
          code: string
          coverage_pct?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description: string
          id?: string
          needs_replenishment?: boolean | null
          plant_equipment: string
          shortfall_amount?: number | null
          stock: string
          stock_status?: string | null
          surplus_amount?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_present?: number
          amount_required?: number
          category?: string
          code?: string
          coverage_pct?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          id?: string
          needs_replenishment?: boolean | null
          plant_equipment?: string
          shortfall_amount?: number | null
          stock?: string
          stock_status?: string | null
          surplus_amount?: number | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plant_inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_inventory_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_inventory_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "plant_inventory_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_inventory_usage: {
        Row: {
          amount_used: number
          circuit_area: string
          created_at: string
          description: string
          id: string
          item_id: string | null
          logged_by: string
          plant_equipment: string
          shift: string
          stock_code: string
          stock_name: string
          unit: string
          usage_date: string
        }
        Insert: {
          amount_used: number
          circuit_area: string
          created_at?: string
          description?: string
          id?: string
          item_id?: string | null
          logged_by: string
          plant_equipment: string
          shift: string
          stock_code: string
          stock_name: string
          unit?: string
          usage_date?: string
        }
        Update: {
          amount_used?: number
          circuit_area?: string
          created_at?: string
          description?: string
          id?: string
          item_id?: string | null
          logged_by?: string
          plant_equipment?: string
          shift?: string
          stock_code?: string
          stock_name?: string
          unit?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_inventory_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "plant_inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_by: string | null
          cups_job_id: number | null
          department_name: string | null
          employee_name: string
          error_message: string | null
          expires_at: string | null
          id: string
          note: string | null
          personnel_id: string | null
          printer_id: string | null
          printing_started_at: string | null
          qr_code_data: string | null
          queued_at: string | null
          rendering_started_at: string | null
          rfid_uid: string | null
          role_title: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_by?: string | null
          cups_job_id?: number | null
          department_name?: string | null
          employee_name: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          personnel_id?: string | null
          printer_id?: string | null
          printing_started_at?: string | null
          qr_code_data?: string | null
          queued_at?: string | null
          rendering_started_at?: string | null
          rfid_uid?: string | null
          role_title?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_by?: string | null
          cups_job_id?: number | null
          department_name?: string | null
          employee_name?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          personnel_id?: string | null
          printer_id?: string | null
          printing_started_at?: string | null
          qr_code_data?: string | null
          queued_at?: string | null
          rendering_started_at?: string | null
          rfid_uid?: string | null
          role_title?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "card_printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_production_daily_log"
            columns: ["daily_log_id", "daily_log_date"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id", "log_date"]
          },
          {
            foreignKeyName: "fk_production_daily_log"
            columns: ["daily_log_id", "daily_log_date"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id", "log_date"]
          },
          {
            foreignKeyName: "fk_production_daily_log"
            columns: ["daily_log_id", "daily_log_date"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "production_logs_created_by_fkey1"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_updated_by_fkey1"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs_2025_01: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_02: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_03: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_04: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_05: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_06: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_07: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_08: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_09: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_10: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_11: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2025_12: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_01: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_02: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_03: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_04: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_05: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_06: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_07: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_08: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_09: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_10: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_11: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2026_12: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_01: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_02: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_03: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_04: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_05: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_06: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_07: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_08: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_09: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_10: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_11: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_2027_12: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string
          daily_log_id: string
          id: string
          updated_at: string
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date: string
          daily_log_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string
          daily_log_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: []
      }
      production_logs_legacy: {
        Row: {
          coal_tonnes: number
          created_at: string
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string
          id: string
          updated_at: string | null
          updated_by: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          waste_tonnes?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_production_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_production_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id", "log_date"]
          },
          {
            foreignKeyName: "fk_production_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "production_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      production_monthly_targets: {
        Row: {
          bcm_target: number
          coal_target_tonnes: number
          created_at: string
          id: string
          notes: string | null
          target_month: string
          updated_at: string
          updated_by: string | null
          waste_target_tonnes: number
        }
        Insert: {
          bcm_target?: number
          coal_target_tonnes?: number
          created_at?: string
          id?: string
          notes?: string | null
          target_month: string
          updated_at?: string
          updated_by?: string | null
          waste_target_tonnes?: number
        }
        Update: {
          bcm_target?: number
          coal_target_tonnes?: number
          created_at?: string
          id?: string
          notes?: string | null
          target_month?: string
          updated_at?: string
          updated_by?: string | null
          waste_target_tonnes?: number
        }
        Relationships: []
      }
      quick_feedback: {
        Row: {
          context: string | null
          created_at: string | null
          id: string
          page_url: string | null
          reaction: string | null
          session_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          id?: string
          page_url?: string | null
          reaction?: string | null
          session_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string | null
          id?: string
          page_url?: string | null
          reaction?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          auto_generate: boolean
          config: Json | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          report_type: string
          updated_at: string | null
        }
        Insert: {
          auto_generate?: boolean
          config?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          report_type: string
          updated_at?: string | null
        }
        Update: {
          auto_generate?: boolean
          config?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          report_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      satellite_deformations: {
        Row: {
          acquisition_date: string
          cog_url: string | null
          coherence_index: number
          created_at: string
          created_by: string | null
          department_id: string
          displacement_mm: number
          id: string
          latitude: number
          location_name: string
          longitude: number
          reference_date: string
          risk_level: string
          satellite_name: string
          updated_at: string
        }
        Insert: {
          acquisition_date: string
          cog_url?: string | null
          coherence_index?: number
          created_at?: string
          created_by?: string | null
          department_id: string
          displacement_mm: number
          id?: string
          latitude: number
          location_name: string
          longitude: number
          reference_date: string
          risk_level?: string
          satellite_name: string
          updated_at?: string
        }
        Update: {
          acquisition_date?: string
          cog_url?: string | null
          coherence_index?: number
          created_at?: string
          created_by?: string | null
          department_id?: string
          displacement_mm?: number
          id?: string
          latitude?: number
          location_name?: string
          longitude?: number
          reference_date?: string
          risk_level?: string
          satellite_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satellite_deformations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_deformations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      secrets_rotation_log: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          notes: string | null
          rotated_at: string | null
          rotated_by: string | null
          secret_name: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
          secret_name: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
          secret_name?: string
          status?: string | null
        }
        Relationships: []
      }
      shift_completeness_alerts: {
        Row: {
          created_at: string
          department_id: string
          id: string
          minutes_into_shift: number
          missing_machine_count: number
          missing_machines: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          shift_date: string
          shift_type: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          minutes_into_shift: number
          missing_machine_count?: number
          missing_machines?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          shift_date: string
          shift_type: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          minutes_into_shift?: number
          missing_machine_count?: number
          missing_machines?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          shift_date?: string
          shift_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_completeness_alerts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_completeness_alerts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "shift_completeness_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_integrity_reports: {
        Row: {
          created_at: string
          id: string
          report_data: Json
          report_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_data: Json
          report_date: string
        }
        Update: {
          created_at?: string
          id?: string
          report_data?: Json
          report_date?: string
        }
        Relationships: []
      }
      shift_status: {
        Row: {
          approved_by: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          department_id: string
          id: string
          notes: string | null
          shift_date: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          status: Database["public"]["Enums"]["shift_status_type"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          department_id: string
          id?: string
          notes?: string | null
          shift_date: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          status?: Database["public"]["Enums"]["shift_status_type"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          department_id?: string
          id?: string
          notes?: string | null
          shift_date?: string
          shift_type?: Database["public"]["Enums"]["shift_type"]
          status?: Database["public"]["Enums"]["shift_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_status_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_status_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_status_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_status_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      sites: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          site_code: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          site_code: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          site_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      slo_metrics: {
        Row: {
          actual_value: number
          created_at: string | null
          error_budget_remaining: number | null
          id: string
          measurement_time: string | null
          metadata: Json | null
          period_end: string
          period_start: string
          slo_name: string
          status: string | null
          target_value: number
        }
        Insert: {
          actual_value: number
          created_at?: string | null
          error_budget_remaining?: number | null
          id?: string
          measurement_time?: string | null
          metadata?: Json | null
          period_end: string
          period_start: string
          slo_name: string
          status?: string | null
          target_value: number
        }
        Update: {
          actual_value?: number
          created_at?: string | null
          error_budget_remaining?: number | null
          id?: string
          measurement_time?: string | null
          metadata?: Json | null
          period_end?: string
          period_start?: string
          slo_name?: string
          status?: string | null
          target_value?: number
        }
        Relationships: []
      }
      smr_readings: {
        Row: {
          device_id: string
          hlc_counter: number
          hlc_wall: number
          meter_id: string
          mutation_id: string
          node_id: string
          reading: number
          reading_at: string
          tenant_id: string
        }
        Insert: {
          device_id: string
          hlc_counter: number
          hlc_wall: number
          meter_id: string
          mutation_id: string
          node_id: string
          reading: number
          reading_at: string
          tenant_id: string
        }
        Update: {
          device_id?: string
          hlc_counter?: number
          hlc_wall?: number
          meter_id?: string
          mutation_id?: string
          node_id?: string
          reading?: number
          reading_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          category: string
          context: Json
          created_at: string
          department_id: string | null
          employee_id: string | null
          id: string
          ip_address: unknown
          level: string
          message: string
          method: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          category?: string
          context?: Json
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: unknown
          level: string
          message: string
          method?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          category?: string
          context?: Json
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: unknown
          level?: string
          message?: string
          method?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "system_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_inspections: {
        Row: {
          condition_status: string
          created_at: string
          current_smu: number | null
          id: string
          inspection_date: string
          machine_operation_id: string | null
          notes: string | null
          pressure_psi: number
          shift_date: string | null
          shift_type: string | null
          tire_id: string
          tread_depth_mm: number
        }
        Insert: {
          condition_status: string
          created_at?: string
          current_smu?: number | null
          id?: string
          inspection_date?: string
          machine_operation_id?: string | null
          notes?: string | null
          pressure_psi: number
          shift_date?: string | null
          shift_type?: string | null
          tire_id: string
          tread_depth_mm: number
        }
        Update: {
          condition_status?: string
          created_at?: string
          current_smu?: number | null
          id?: string
          inspection_date?: string
          machine_operation_id?: string | null
          notes?: string | null
          pressure_psi?: number
          shift_date?: string | null
          shift_type?: string | null
          tire_id?: string
          tread_depth_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "tire_inspections_machine_operation_id_fkey"
            columns: ["machine_operation_id"]
            isOneToOne: false
            referencedRelation: "machine_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_inspections_machine_operation_id_fkey"
            columns: ["machine_operation_id"]
            isOneToOne: false
            referencedRelation: "machine_operations_with_delays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_inspections_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tires"
            referencedColumns: ["id"]
          },
        ]
      }
      tires: {
        Row: {
          brand: string
          created_at: string
          id: string
          installed_at: string
          installed_hours: number
          machine_id: string | null
          position: string
          removed_at: string | null
          removed_hours: number | null
          scrapped_reason: string | null
          serial_number: string
          size: string
          status: string
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          installed_at?: string
          installed_hours?: number
          machine_id?: string | null
          position: string
          removed_at?: string | null
          removed_hours?: number | null
          scrapped_reason?: string | null
          serial_number: string
          size: string
          status: string
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          installed_at?: string
          installed_hours?: number
          machine_id?: string | null
          position?: string
          removed_at?: string | null
          removed_hours?: number | null
          scrapped_reason?: string | null
          serial_number?: string
          size?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tires_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "tires_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          assigned_to: string | null
          comment: string | null
          created_at: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          page_url: string | null
          rating: number | null
          session_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          rating?: number | null
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          rating?: number | null
          session_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_search_cache: {
        Row: {
          access_count: number | null
          cache_key: string
          created_at: string
          last_accessed_at: string
          memory_type: string | null
          query_params: Json
          result_data: Json
          ttl_seconds: number | null
          user_id: string
        }
        Insert: {
          access_count?: number | null
          cache_key: string
          created_at?: string
          last_accessed_at?: string
          memory_type?: string | null
          query_params: Json
          result_data: Json
          ttl_seconds?: number | null
          user_id: string
        }
        Update: {
          access_count?: number | null
          cache_key?: string
          created_at?: string
          last_accessed_at?: string
          memory_type?: string | null
          query_params?: Json
          result_data?: Json
          ttl_seconds?: number | null
          user_id?: string
        }
        Relationships: []
      }
      vector_search_performance: {
        Row: {
          cache_hit: boolean | null
          created_at: string
          ef_search: number
          execution_time_ms: number
          id: string
          match_count: number
          result_count: number
          search_type: string
          user_id: string
        }
        Insert: {
          cache_hit?: boolean | null
          created_at?: string
          ef_search: number
          execution_time_ms: number
          id?: string
          match_count: number
          result_count: number
          search_type: string
          user_id: string
        }
        Update: {
          cache_hit?: boolean | null
          created_at?: string
          ef_search?: number
          execution_time_ms?: number
          id?: string
          match_count?: number
          result_count?: number
          search_type?: string
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          company: string | null
          created_at: string | null
          department_id: string | null
          first_name: string | null
          host_id: string | null
          host_user_id: string | null
          id: string
          id_number: string | null
          last_name: string | null
          name: string
          purpose: string | null
          reason_for_entry: string | null
          status: string | null
          surname: string | null
          visiting: string | null
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          company?: string | null
          created_at?: string | null
          department_id?: string | null
          first_name?: string | null
          host_id?: string | null
          host_user_id?: string | null
          id?: string
          id_number?: string | null
          last_name?: string | null
          name: string
          purpose?: string | null
          reason_for_entry?: string | null
          status?: string | null
          surname?: string | null
          visiting?: string | null
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          company?: string | null
          created_at?: string | null
          department_id?: string | null
          first_name?: string | null
          host_id?: string | null
          host_user_id?: string | null
          id?: string
          id_number?: string | null
          last_name?: string | null
          name?: string
          purpose?: string | null
          reason_for_entry?: string | null
          status?: string | null
          surname?: string | null
          visiting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "visitors_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_logs: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          retry_count: number
          success: boolean
          webhook_endpoint_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          success?: boolean
          webhook_endpoint_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          success?: boolean
          webhook_endpoint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_logs_webhook_endpoint_id_fkey"
            columns: ["webhook_endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          department_id: string | null
          description: string | null
          event_types: string[]
          id: string
          secret: string | null
          svix_endpoint_id: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          event_types?: string[]
          id?: string
          secret?: string | null
          svix_endpoint_id?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          event_types?: string[]
          id?: string
          secret?: string | null
          svix_endpoint_id?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
    }
    Views: {
      ai_token_usage_by_department: {
        Row: {
          department_id: string | null
          department_name: string | null
          model_name: string | null
          request_count: number | null
          total_cost_cents: number | null
          total_tokens: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_usage_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_token_usage_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      ai_token_usage_daily: {
        Row: {
          avg_latency_ms: number | null
          model_name: string | null
          model_provider: string | null
          request_count: number | null
          total_cached_tokens: number | null
          total_completion_tokens: number | null
          total_cost_cents: number | null
          total_prompt_tokens: number | null
          total_tokens: number | null
          usage_date: string | null
        }
        Relationships: []
      }
      breakdowns_control_room_view: {
        Row: {
          created_at: string | null
          date_in: string | null
          date_out: string | null
          fleet_id: string | null
          id: string | null
          machine_name: string | null
          machine_type: string | null
          reason: string | null
          status: string | null
          time_in: string | null
        }
        Insert: {
          created_at?: string | null
          date_in?: string | null
          date_out?: string | null
          fleet_id?: string | null
          id?: string | null
          machine_name?: string | null
          machine_type?: string | null
          reason?: string | null
          status?: string | null
          time_in?: string | null
        }
        Update: {
          created_at?: string | null
          date_in?: string | null
          date_out?: string | null
          fleet_id?: string | null
          id?: string | null
          machine_name?: string | null
          machine_type?: string | null
          reason?: string | null
          status?: string | null
          time_in?: string | null
        }
        Relationships: []
      }
      current_slo_status: {
        Row: {
          current_status: string | null
          current_value: number | null
          error_budget_remaining: number | null
          last_measurement: string | null
          slo_name: string | null
          target: number | null
        }
        Relationships: []
      }
      dept_production_summary: {
        Row: {
          department_display_name: string | null
          department_id: string | null
          department_name: string | null
          last_refreshed_at: string | null
          log_count: number | null
          summary_month: string | null
          total_coal_tonnes: number | null
          total_tonnes: number | null
          total_waste_tonnes: number | null
        }
        Relationships: []
      }
      machine_operations_with_delays: {
        Row: {
          block_drilled: string | null
          created_at: string | null
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string | null
          delay_breakdown: Json | null
          delay_entry_count: number | null
          department_id: string | null
          end_smu: number | null
          end_time: string | null
          holes_drilled: number | null
          hours_worked: number | null
          id: string | null
          machine_id: string | null
          meters_drilled: number | null
          operational_status:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id: string | null
          operator_name: string | null
          shift_date: string | null
          shift_type: string | null
          site_code: string | null
          site_id: string | null
          start_smu: number | null
          start_time: string | null
          total_delay_hours: number | null
          updated_at: string | null
        }
        Insert: {
          block_drilled?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          delay_breakdown?: never
          delay_entry_count?: never
          department_id?: string | null
          end_smu?: number | null
          end_time?: string | null
          holes_drilled?: number | null
          hours_worked?: number | null
          id?: string | null
          machine_id?: string | null
          meters_drilled?: number | null
          operational_status?:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id?: string | null
          operator_name?: string | null
          shift_date?: string | null
          shift_type?: string | null
          site_code?: string | null
          site_id?: string | null
          start_smu?: number | null
          start_time?: string | null
          total_delay_hours?: never
          updated_at?: string | null
        }
        Update: {
          block_drilled?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_log_date?: string | null
          daily_log_id?: string | null
          delay_breakdown?: never
          delay_entry_count?: never
          department_id?: string | null
          end_smu?: number | null
          end_time?: string | null
          holes_drilled?: number | null
          hours_worked?: number | null
          id?: string | null
          machine_id?: string | null
          meters_drilled?: number | null
          operational_status?:
            | Database["public"]["Enums"]["machine_operational_status"]
            | null
          operator_id?: string | null
          operator_name?: string | null
          shift_date?: string | null
          shift_type?: string | null
          site_code?: string | null
          site_id?: string | null
          start_smu?: number | null
          start_time?: string | null
          total_delay_hours?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_machine_ops_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_machine_ops_daily_log"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "view_production_summary"
            referencedColumns: ["daily_log_id"]
          },
          {
            foreignKeyName: "machine_operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "machine_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_utilization_weekly"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machine_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_operations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_utilization_weekly: {
        Row: {
          department_id: string | null
          department_name: string | null
          last_refreshed_at: string | null
          machine_id: string | null
          machine_name: string | null
          machine_type: string | null
          shifts_recorded: number | null
          total_hours_worked: number | null
          utilization_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
        ]
      }
      smr_latest: {
        Row: {
          device_id: string | null
          hlc_counter: number | null
          hlc_wall: number | null
          meter_id: string | null
          node_id: string | null
          reading: number | null
          reading_at: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      view_hourly_production: {
        Row: {
          department_id: string | null
          department_name: string | null
          hour_timestamp: string | null
          material_type: string | null
          total_loads: number | null
          total_tonnes: number | null
        }
        Relationships: []
      }
      view_production_summary: {
        Row: {
          actual_coal_tonnes: number | null
          actual_total_tonnes: number | null
          actual_waste_tonnes: number | null
          approved_by: string | null
          bcm_coal: number | null
          bcm_waste: number | null
          daily_log_id: string | null
          department_id: string | null
          expected_total_tonnes: number | null
          last_refreshed_at: string | null
          log_date: string | null
          reconciliation_drift_pct: number | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          shift_status: Database["public"]["Enums"]["shift_status_type"] | null
          tonnes_per_hour: number | null
          total_bcm: number | null
          total_fuel_litres: number | null
          total_hours_worked: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dept_production_summary"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "shift_status_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_partition_check_constraints: { Args: never; Returns: undefined }
      apply_offline_mutations: {
        Args: { p_mutations: Json; p_tenant: string }
        Returns: Json
      }
      archive_monthly_control_room_shifts: { Args: never; Returns: undefined }
      archive_monthly_drill_operations: { Args: never; Returns: undefined }
      archive_old_partitions: {
        Args: { months_to_keep?: number }
        Returns: undefined
      }
      atomic_approve_shift_report: {
        Args: {
          p_approval_note?: string
          p_approver_id?: string
          p_report_id: string
        }
        Returns: Json
      }
      atomic_machine_operator_dispatch: {
        Args: {
          p_created_by: string
          p_department_id: string
          p_machine_id: string
          p_operator_id: string
          p_shift_date: string
          p_shift_type: string
          p_site_id: string
          p_start_time: string
        }
        Returns: Json
      }
      atomic_shift_closeout: {
        Args: {
          p_alarm_response_avg: number
          p_checklist: Json
          p_completed_count: number
          p_date: string
          p_dept_id: string
          p_employee_id: string
          p_idempotency_key: string
          p_incident_ack_avg: number
          p_missed_count: number
          p_operator_name: string
          p_request_hash: string
          p_route: string
          p_shift: string
          p_summary: string
          p_supervisor_signature: string
          p_total_count: number
          p_uptime_percent: number
          p_user_id: string
        }
        Returns: Json
      }
      atomic_split_hourly_load: {
        Args: {
          p_department_id: string
          p_excavator_id: string
          p_load_date: string
          p_machine_id: string
          p_material_type: string
          p_previous_load_id: string
          p_shift_type: string
          p_start_hour: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          daily_log_date: string | null
          daily_log_id: string | null
          department_id: string
          end_hour: number
          excavator_id: string | null
          hour_01: number
          hour_02: number
          hour_03: number
          hour_04: number
          hour_05: number
          hour_06: number
          hour_07: number
          hour_08: number
          hour_09: number
          hour_10: number
          hour_11: number
          hour_12: number
          id: string
          is_locked: boolean
          load_date: string
          machine_id: string
          material_type: string
          shift_type: string
          start_hour: number
          total_loads: number | null
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "hourly_loads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cache_vector_search_results: {
        Args: {
          p_cache_key: string
          p_memory_type?: string
          p_query_params: Json
          p_result_data: Json
          p_ttl_seconds?: number
          p_user_id: string
        }
        Returns: undefined
      }
      can_access_department: {
        Args: {
          p_department_id: string
          p_level?: Database["public"]["Enums"]["department_access_level"]
        }
        Returns: boolean
      }
      check_mv_freshness: {
        Args: { p_max_age_minutes?: number; p_view_name: string }
        Returns: {
          age_minutes: number
          is_fresh: boolean
          last_refresh: string
          mv_name: string
          refresh_status: string
        }[]
      }
      cleanup_vector_search_cache: { Args: never; Returns: number }
      create_next_month_partitions: { Args: never; Returns: undefined }
      current_employee_id: { Args: never; Returns: string }
      evaluate_feature_flag: {
        Args: { p_flag_key: string; p_session_id?: string; p_user_id?: string }
        Returns: Json
      }
      generate_vector_search_cache_key: {
        Args: {
          p_match_count: number
          p_memory_type: string
          p_similarity_threshold: number
          p_user_id: string
        }
        Returns: string
      }
      get_access_control_metrics_jsonb: {
        Args: { p_department_id: string }
        Returns: Json
      }
      get_avg_tire_lifespan: {
        Args: never
        Returns: {
          avg_lifespan_days: number
          avg_lifespan_hours: number
          brand: string
          machine_type: string
          scrapped_count: number
        }[]
      }
      get_cached_vector_search: {
        Args: { p_cache_key: string; p_user_id: string }
        Returns: Json
      }
      get_conversation_history: {
        Args: {
          message_limit?: number
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          metadata: Json
        }[]
      }
      get_drill_monthly_summary: {
        Args: { p_department_id: string; p_year_month: string }
        Returns: {
          availability_pct: number
          downtime_hours: number
          machine_id: string
          machine_name: string
          productive_hours: number
          scheduled_hours: number
          utilization_pct: number
        }[]
      }
      get_employee_department: { Args: never; Returns: string }
      get_machine_latest_closing_smr: {
        Args: { p_machine_id: string }
        Returns: number
      }
      get_monolithized_department_dashboard_payload: {
        Args: { dept_id: string }
        Returns: Json
      }
      get_multi_site_shift_compilation: {
        Args: {
          p_department_id: string
          p_shift_date: string
          p_shift_type: string
        }
        Returns: Json
      }
      get_mv_refresh_stats: {
        Args: { p_days?: number; p_view_name?: string }
        Returns: {
          avg_duration_ms: number
          failed_refreshes: number
          last_refresh: string
          last_status: string
          max_duration_ms: number
          mv_name: string
          skipped_refreshes: number
          successful_refreshes: number
          total_refreshes: number
        }[]
      }
      get_pg_cron_jobs_health: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          last_run_status: string
          last_run_time: string
          schedule: string
        }[]
      }
      get_production_summary: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          actual_coal_tonnes: number | null
          actual_total_tonnes: number | null
          actual_waste_tonnes: number | null
          approved_by: string | null
          bcm_coal: number | null
          bcm_waste: number | null
          daily_log_id: string | null
          department_id: string | null
          expected_total_tonnes: number | null
          last_refreshed_at: string | null
          log_date: string | null
          reconciliation_drift_pct: number | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          shift_status: Database["public"]["Enums"]["shift_status_type"] | null
          tonnes_per_hour: number | null
          total_bcm: number | null
          total_fuel_litres: number | null
          total_hours_worked: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "view_production_summary"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_production_trend: {
        Args: { p_hours_back?: number }
        Returns: {
          department_name: string
          hour_label: string
          tonnes: number
        }[]
      }
      get_slow_queries: {
        Args: { p_limit?: number }
        Returns: {
          calls: number
          max_exec_time: number
          mean_exec_time: number
          query: string
          total_exec_time: number
        }[]
      }
      get_telemetry_summary: {
        Args: {
          p_department_id: string
          p_granularity?: string
          p_machine_id?: string
        }
        Returns: {
          avg_engine_rpm: number
          avg_engine_temp: number
          avg_hydraulic_pressure: number
          avg_penetration_rate: number
          machine_id: string
          machine_name: string
          max_bit_depth: number
          max_hole_depth: number
          period: string
          record_count: number
          total_alerts: number
        }[]
      }
      get_unified_shift_compilation: {
        Args: {
          p_department_id: string
          p_shift_date: string
          p_shift_type: string
        }
        Returns: Json
      }
      has_department_access: { Args: { dept_id: string }; Returns: boolean }
      has_permission: { Args: { p_permission: string }; Returns: boolean }
      is_access_control: { Args: never; Returns: boolean }
      is_active: { Args: { record_deleted_at: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      log_mv_refresh_end: {
        Args: {
          p_error_message?: string
          p_log_id: string
          p_rows_affected?: number
          p_status: string
        }
        Returns: undefined
      }
      log_mv_refresh_start: {
        Args: {
          p_is_concurrent?: boolean
          p_triggered_by?: string
          p_view_name: string
        }
        Returns: string
      }
      record_slo_measurement: {
        Args: {
          p_actual_value: number
          p_error_budget: number
          p_metadata?: Json
          p_period_end: string
          p_period_start: string
          p_slo_name: string
          p_target_value: number
        }
        Returns: string
      }
      record_vector_search_performance: {
        Args: {
          p_cache_hit?: boolean
          p_ef_search: number
          p_execution_time_ms: number
          p_match_count: number
          p_result_count: number
          p_search_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      refresh_dept_production_summary_smart: { Args: never; Returns: undefined }
      refresh_hourly_production: { Args: never; Returns: undefined }
      refresh_machine_utilization_weekly_smart: {
        Args: never
        Returns: undefined
      }
      refresh_production_summary: { Args: never; Returns: undefined }
      refresh_safety_incident_monthly_smart: { Args: never; Returns: undefined }
      search_memories_hybrid: {
        Args: {
          ef_search?: number
          keyword_weight?: number
          match_count?: number
          p_memory_type?: string
          p_session_id?: string
          p_user_id: string
          query_embedding: string
          query_text: string
          semantic_weight?: number
          temporal_weight?: number
        }
        Returns: {
          combined_score: number
          content: string
          created_at: string
          id: string
          keyword_score: number
          memory_type: string
          metadata: Json
          semantic_score: number
          session_id: string
          temporal_score: number
        }[]
      }
      search_memories_semantic: {
        Args: {
          ef_search?: number
          match_count?: number
          p_memory_type?: string
          p_session_id?: string
          p_user_id: string
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          content: string
          created_at: string
          id: string
          memory_type: string
          metadata: Json
          session_id: string
          similarity: number
        }[]
      }
      submit_quick_feedback: {
        Args: {
          p_context?: string
          p_page_url: string
          p_reaction: string
          p_session_id?: string
        }
        Returns: string
      }
      submit_user_feedback: {
        Args: {
          p_comment?: string
          p_feedback_type: string
          p_page_url: string
          p_rating?: number
          p_user_id?: string
        }
        Returns: string
      }
      user_department_id: { Args: never; Returns: string }
      uuid_generate_v4: { Args: never; Returns: string }
    }
    Enums: {
      department_access_level: "read" | "operate" | "supervise" | "manage"
      incident_type: "near-miss" | "incident" | "lost-time" | "equipment-damage"
      machine_operational_status:
        | "ACTIVE"
        | "STANDBY"
        | "BREAKDOWN"
        | "BREDELL"
        | "NO_OPERATOR"
        | "NO_SPACE"
        | "OFFSITE"
      memory_type: "episodic" | "semantic"
      outbox_status: "pending" | "processing" | "completed" | "failed" | "dlq"
      role_type:
        | "admin"
        | "supervisor"
        | "operator"
        | "maintenance"
        | "viewer"
        | "trainer"
        | "relief"
      shift_status_type: "open" | "closed"
      shift_type: "day" | "night"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      department_access_level: ["read", "operate", "supervise", "manage"],
      incident_type: ["near-miss", "incident", "lost-time", "equipment-damage"],
      machine_operational_status: [
        "ACTIVE",
        "STANDBY",
        "BREAKDOWN",
        "BREDELL",
        "NO_OPERATOR",
        "NO_SPACE",
        "OFFSITE",
      ],
      memory_type: ["episodic", "semantic"],
      outbox_status: ["pending", "processing", "completed", "failed", "dlq"],
      role_type: [
        "admin",
        "supervisor",
        "operator",
        "maintenance",
        "viewer",
        "trainer",
        "relief",
      ],
      shift_status_type: ["open", "closed"],
      shift_type: ["day", "night"],
    },
  },
} as const
