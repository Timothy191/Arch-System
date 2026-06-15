export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      delay_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      delay_entries: {
        Row: {
          id: string;
          machine_operation_id: string;
          delay_category_id: string;
          delay_start_time: string;
          delay_end_time: string | null; // AGENT-TRACE: Nullable for manual override cases
          duration_hours: number;
          is_manual_override: boolean;
          manual_duration_hours: number | null;
          description: string | null;
          status: "draft" | "committed";
          committed_at: string | null;
          committed_by: string | null;
          uncommitted_at: string | null;
          uncommitted_by: string | null;
          uncommit_reason: string | null;
          // AGENT-TRACE: Soft delete fields
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          machine_operation_id: string;
          delay_category_id: string;
          delay_start_time: string;
          delay_end_time: string | null; // AGENT-TRACE: Nullable for manual override cases
          is_manual_override?: boolean;
          manual_duration_hours?: number | null;
          description?: string | null;
          status?: "draft" | "committed";
          committed_at?: string | null;
          committed_by?: string | null;
          uncommitted_at?: string | null;
          uncommitted_by?: string | null;
          uncommit_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          // AGENT-TRACE: Soft delete fields
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
        Update: {
          id?: string;
          machine_operation_id?: string;
          delay_category_id?: string;
          delay_start_time?: string;
          delay_end_time?: string | null; // AGENT-TRACE: Nullable for manual override cases
          is_manual_override?: boolean;
          manual_duration_hours?: number | null;
          description?: string | null;
          status?: "draft" | "committed";
          committed_at?: string | null;
          committed_by?: string | null;
          uncommitted_at?: string | null;
          uncommitted_by?: string | null;
          uncommit_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          // AGENT-TRACE: Soft delete fields
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
      };
    };
  };
}
