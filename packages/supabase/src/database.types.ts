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
  public: {
    Tables: {
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
            foreignKeyName: "audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "employees"
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
          deleted_at: string | null
          department_id: string
          fleet_id: string
          id: string
          machine_type: string
          missing_book_in: boolean
          reason: string
          repair_notes: string | null
          status: string
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
          deleted_at?: string | null
          department_id: string
          fleet_id: string
          id?: string
          machine_type: string
          missing_book_in?: boolean
          reason: string
          repair_notes?: string | null
          status?: string
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
          deleted_at?: string | null
          department_id?: string
          fleet_id?: string
          id?: string
          machine_type?: string
          missing_book_in?: boolean
          reason?: string
          repair_notes?: string | null
          status?: string
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
        ]
      }
      daily_logs: {
        Row: {
          created_at: string
          department_id: string
          id: string
          log_date: string
          notes: string | null
          shift: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          log_date: string
          notes?: string | null
          shift: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          log_date?: string
          notes?: string | null
          shift?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_categories: {
        Row: {
          color: string
          deleted_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          color?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string | null
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
      dozer_rolls: {
        Row: {
          area_covered_sqm: number | null
          blade_passes: number
          created_at: string
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
        ]
      }
      employees: {
        Row: {
          accessible_departments: string[] | null
          auth_id: string
          created_at: string
          deleted_at: string | null
          department_id: string | null
          full_name: string
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          accessible_departments?: string[] | null
          auth_id: string
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          full_name: string
          id?: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          accessible_departments?: string[] | null
          auth_id?: string
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          full_name?: string
          id?: string
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
            foreignKeyName: "engineering_notes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      excavator_activity: {
        Row: {
          activity_date: string
          avg_cycle_time_seconds: number | null
          block_mined_id: string | null
          created_at: string
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
        ]
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
      fuel_logs: {
        Row: {
          created_at: string
          daily_log_id: string
          diesel_litres: number
          id: string
          machine_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          daily_log_id: string
          diesel_litres?: number
          id?: string
          machine_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          daily_log_id?: string
          diesel_litres?: number
          id?: string
          machine_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
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
          department_id: string
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
          load_date: string
          machine_id: string
          shift_type: string
          total_loads: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
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
          load_date: string
          machine_id: string
          shift_type: string
          total_loads?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
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
          load_date?: string
          machine_id?: string
          shift_type?: string
          total_loads?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_loads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_loads_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_hours: {
        Row: {
          created_at: string
          daily_log_id: string
          hours_worked: number
          id: string
          machine_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          daily_log_id: string
          hours_worked?: number
          id?: string
          machine_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          daily_log_id?: string
          hours_worked?: number
          id?: string
          machine_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_hours_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hours_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_operations: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          end_time: string | null
          hours_worked: number | null
          id: string
          machine_id: string
          operator_id: string | null
          shift_date: string
          shift_type: string
          site_id: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          end_time?: string | null
          hours_worked?: number | null
          id?: string
          machine_id: string
          operator_id?: string | null
          shift_date: string
          shift_type: string
          site_id?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          end_time?: string | null
          hours_worked?: number | null
          id?: string
          machine_id?: string
          operator_id?: string | null
          shift_date?: string
          shift_type?: string
          site_id?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
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
      machines: {
        Row: {
          active: boolean
          bin_factor: number | null
          created_at: string
          deleted_at: string | null
          department_id: string
          id: string
          machine_type: string
          name: string
          serial_number: string | null
          site_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          bin_factor?: number | null
          created_at?: string
          deleted_at?: string | null
          department_id: string
          id?: string
          machine_type: string
          name: string
          serial_number?: string | null
          site_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          bin_factor?: number | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string
          id?: string
          machine_type?: string
          name?: string
          serial_number?: string | null
          site_id?: string | null
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
            foreignKeyName: "machines_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          memory_type: string
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
          memory_type?: string
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
          memory_type?: string
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
      operational_delays: {
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
      production_logs: {
        Row: {
          coal_tonnes: number
          created_at: string
          daily_log_id: string
          id: string
          updated_at: string | null
          waste_tonnes: number
        }
        Insert: {
          coal_tonnes?: number
          created_at?: string
          daily_log_id: string
          id?: string
          updated_at?: string | null
          waste_tonnes?: number
        }
        Update: {
          coal_tonnes?: number
          created_at?: string
          daily_log_id?: string
          id?: string
          updated_at?: string | null
          waste_tonnes?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
        ]
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
          description?: string | null
          id?: string
          name?: string
          report_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      safety_incident_categories: {
        Row: {
          color: string
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          color?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      safety_incidents: {
        Row: {
          category_id: string | null
          closed_at: string | null
          corrective_action: string
          created_at: string
          department_id: string
          description: string
          id: string
          incident_date: string
          incident_type: string
          injured_parties: number
          location: string
          reported_by: string | null
          reviewed_by: string | null
          root_cause: string
          severity_id: string | null
          shift_type: string
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          closed_at?: string | null
          corrective_action: string
          created_at?: string
          department_id: string
          description: string
          id?: string
          incident_date: string
          incident_type: string
          injured_parties?: number
          location: string
          reported_by?: string | null
          reviewed_by?: string | null
          root_cause: string
          severity_id?: string | null
          shift_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          closed_at?: string | null
          corrective_action?: string
          created_at?: string
          department_id?: string
          description?: string
          id?: string
          incident_date?: string
          incident_type?: string
          injured_parties?: number
          location?: string
          reported_by?: string | null
          reviewed_by?: string | null
          root_cause?: string
          severity_id?: string | null
          shift_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_incidents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "safety_incident_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_incidents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_incidents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_incidents_severity_id_fkey"
            columns: ["severity_id"]
            isOneToOne: false
            referencedRelation: "safety_severities"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_severities: {
        Row: {
          color: string
          id: string
          level: string
          sort_order: number
          updated_at: string | null
          weight: number
        }
        Insert: {
          color?: string
          id?: string
          level: string
          sort_order?: number
          updated_at?: string | null
          weight?: number
        }
        Update: {
          color?: string
          id?: string
          level?: string
          sort_order?: number
          updated_at?: string | null
          weight?: number
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      has_department_access: { Args: { dept_id: string }; Returns: boolean }
      is_active: { Args: { record_deleted_at: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      search_memories_hybrid: {
        Args: {
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
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
