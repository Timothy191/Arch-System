/**
 * Manual database type definitions.
 *
 * These tables exist in SQL migrations but are missing from the auto-generated
 * database.types.ts (which is stale). Once `supabase:gen` can be run against
 * a fully migrated local database, this file should be replaced by regenerated types.
 *
 * Tables covered:
 * - departments, employees (migration 001)
 * - personnel, visitors, badges, access_logs (migration 028)
 * - card_printers, card_templates, print_jobs, issued_cards (migration 076)
 * - delay_entries (migration 068)
 */

// Json type for jsonb columns
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// === departments (migration 001) ===

export interface DepartmentsRow {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  description: string | null;
  color: string;
  created_at: string;
}

export interface DepartmentsInsert {
  id?: string;
  name: string;
  display_name: string;
  icon: string;
  description?: string | null;
  color: string;
  created_at?: string;
}

export interface DepartmentsUpdate {
  id?: string;
  name?: string;
  display_name?: string;
  icon?: string;
  description?: string | null;
  color?: string;
  created_at?: string;
}

// === employees (migration 001) ===

export interface EmployeesRow {
  id: string;
  auth_id: string;
  department_id: string | null;
  full_name: string;
  first_name: string | null; // Added by migration 080
  last_name: string | null; // Added by migration 080
  national_id: string | null; // Added by migration 080
  job_title: string | null; // Added by migration 080
  areas: string[] | null; // Added by migration 080
  medical_expiry_date: string | null; // Added by migration 080
  induction_expiry_date: string | null; // Added by migration 080
  qr_code_data: string | null; // Added by migration 080
  photo_url: string | null; // Added by migration 080
  role: string;
  accessible_departments: string[];
  employee_code: string | null; // Added by migration 015
  pin_hash: string | null; // Added by migration 015
  created_at: string;
  updated_at: string | null; // Added by migration 014
  deleted_at: string | null; // Added by migration 010
}

export interface EmployeesInsert {
  id?: string;
  auth_id: string;
  department_id?: string | null;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  national_id?: string | null;
  job_title?: string | null;
  areas?: string[] | null;
  medical_expiry_date?: string | null;
  induction_expiry_date?: string | null;
  qr_code_data?: string | null;
  photo_url?: string | null;
  role?: string;
  accessible_departments?: string[];
  employee_code?: string | null;
  pin_hash?: string | null;
  created_at?: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface EmployeesUpdate {
  id?: string;
  auth_id?: string;
  department_id?: string | null;
  full_name?: string;
  first_name?: string | null;
  last_name?: string | null;
  national_id?: string | null;
  job_title?: string | null;
  areas?: string[] | null;
  medical_expiry_date?: string | null;
  induction_expiry_date?: string | null;
  qr_code_data?: string | null;
  photo_url?: string | null;
  role?: string;
  accessible_departments?: string[];
  employee_code?: string | null;
  pin_hash?: string | null;
  created_at?: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

// === personnel (migration 028) ===

export interface PersonnelRow {
  id: string;
  emp_code: string;
  first_name: string;
  surname: string;
  id_number: string;
  job_title: string | null;
  department_id: string | null;
  area: string | null; // Added by migration 037
  induction_expiry: string | null;
  medical_expiry: string | null;
  status: string;
  photo_url: string | null; // Added by migration 076
  created_at: string;
  updated_at: string;
}

export interface PersonnelInsert {
  id?: string;
  emp_code: string;
  first_name: string;
  surname: string;
  id_number: string;
  job_title?: string | null;
  department_id?: string | null;
  area?: string | null;
  induction_expiry?: string | null;
  medical_expiry?: string | null;
  status?: string;
  photo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonnelUpdate {
  id?: string;
  emp_code?: string;
  first_name?: string;
  surname?: string;
  id_number?: string;
  job_title?: string | null;
  department_id?: string | null;
  area?: string | null;
  induction_expiry?: string | null;
  medical_expiry?: string | null;
  status?: string;
  photo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// === visitors (migration 028) ===

export interface VisitorsRow {
  id: string;
  name: string;
  company: string | null;
  purpose: string | null;
  host_id: string | null;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  created_at: string;
}

export interface VisitorsInsert {
  id?: string;
  name: string;
  company?: string | null;
  purpose?: string | null;
  host_id?: string | null;
  check_in_time?: string;
  check_out_time?: string | null;
  status?: string;
  created_at?: string;
}

export interface VisitorsUpdate {
  id?: string;
  name?: string;
  company?: string | null;
  purpose?: string | null;
  host_id?: string | null;
  check_in_time?: string;
  check_out_time?: string | null;
  status?: string;
  created_at?: string;
}

// === badges (migration 028) ===

export interface BadgesRow {
  id: string;
  qr_code: string;
  entity_type: "personnel" | "visitor" | "vehicle";
  personnel_id: string | null;
  visitor_id: string | null;
  is_active: boolean;
  issued_at: string;
  revoked_at: string | null;
}

export interface BadgesInsert {
  id?: string;
  qr_code: string;
  entity_type: "personnel" | "visitor" | "vehicle";
  personnel_id?: string | null;
  visitor_id?: string | null;
  is_active?: boolean;
  issued_at?: string;
  revoked_at?: string | null;
}

export interface BadgesUpdate {
  id?: string;
  qr_code?: string;
  entity_type?: "personnel" | "visitor" | "vehicle";
  personnel_id?: string | null;
  visitor_id?: string | null;
  is_active?: boolean;
  issued_at?: string;
  revoked_at?: string | null;
}

// === access_logs (migration 028) ===

export interface AccessLogsRow {
  id: string;
  badge_id: string | null;
  access_type: string;
  direction: "IN" | "OUT";
  gate_location: string;
  access_granted: boolean;
  denial_reason: string | null;
  scanned_at: string;
  department_id: string | null;
}

export interface AccessLogsInsert {
  id?: string;
  badge_id?: string | null;
  access_type: string;
  direction: "IN" | "OUT";
  gate_location: string;
  access_granted?: boolean;
  denial_reason?: string | null;
  scanned_at?: string;
  department_id?: string | null;
}

export interface AccessLogsUpdate {
  id?: string;
  badge_id?: string | null;
  access_type?: string;
  direction?: "IN" | "OUT";
  gate_location?: string;
  access_granted?: boolean;
  denial_reason?: string | null;
  scanned_at?: string;
  department_id?: string | null;
}

// === card_printers (migration 076) ===

export interface CardPrintersRow {
  id: string;
  name: string;
  model: string;
  cups_name: string;
  connection_type: string;
  vendor_id: string | null;
  product_id: string | null;
  device_path: string | null;
  status: string;
  status_message: string | null;
  last_online_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CardPrintersInsert {
  id?: string;
  name: string;
  model?: string;
  cups_name: string;
  connection_type?: string;
  vendor_id?: string | null;
  product_id?: string | null;
  device_path?: string | null;
  status?: string;
  status_message?: string | null;
  last_online_at?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CardPrintersUpdate {
  id?: string;
  name?: string;
  model?: string;
  cups_name?: string;
  connection_type?: string;
  vendor_id?: string | null;
  product_id?: string | null;
  device_path?: string | null;
  status?: string;
  status_message?: string | null;
  last_online_at?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

// === card_templates (migration 076) ===

export interface CardTemplatesRow {
  id: string;
  name: string;
  description: string | null;
  layout: Json;
  fields: string[];
  background: string;
  default_expiry_days: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CardTemplatesInsert {
  id?: string;
  name: string;
  description?: string | null;
  layout?: Json;
  fields?: string[];
  background?: string;
  default_expiry_days?: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CardTemplatesUpdate {
  id?: string;
  name?: string;
  description?: string | null;
  layout?: Json;
  fields?: string[];
  background?: string;
  default_expiry_days?: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

// === print_jobs (migration 076) ===

export interface PrintJobsRow {
  id: string;
  printer_id: string | null;
  template_id: string | null;
  personnel_id: string | null;
  status: string;
  cups_job_id: number | null;
  error_message: string | null;
  employee_name: string;
  department_name: string | null;
  role_title: string | null;
  qr_code_data: string | null;
  rfid_uid: string | null;
  queued_at: string;
  rendering_started_at: string | null;
  printing_started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  note: string | null;
}

export interface PrintJobsInsert {
  id?: string;
  printer_id?: string | null;
  template_id?: string | null;
  personnel_id?: string | null;
  status?: string;
  cups_job_id?: number | null;
  error_message?: string | null;
  employee_name: string;
  department_name?: string | null;
  role_title?: string | null;
  qr_code_data?: string | null;
  rfid_uid?: string | null;
  queued_at?: string;
  rendering_started_at?: string | null;
  printing_started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  expires_at?: string | null;
  created_by?: string | null;
  note?: string | null;
}

export interface PrintJobsUpdate {
  id?: string;
  printer_id?: string | null;
  template_id?: string | null;
  personnel_id?: string | null;
  status?: string;
  cups_job_id?: number | null;
  error_message?: string | null;
  employee_name?: string;
  department_name?: string | null;
  role_title?: string | null;
  qr_code_data?: string | null;
  rfid_uid?: string | null;
  queued_at?: string;
  rendering_started_at?: string | null;
  printing_started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  expires_at?: string | null;
  created_by?: string | null;
  note?: string | null;
}

// === issued_cards (migration 076) ===

export interface IssuedCardsRow {
  id: string;
  personnel_id: string | null;
  print_job_id: string | null;
  qr_code_data: string;
  rfid_uid: string | null;
  issued_at: string;
  expires_at: string | null;
  status: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  lost_at: string | null;
  replaced_by: string | null;
}

export interface IssuedCardsInsert {
  id?: string;
  personnel_id?: string | null;
  print_job_id?: string | null;
  qr_code_data: string;
  rfid_uid?: string | null;
  issued_at?: string;
  expires_at?: string | null;
  status?: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  lost_at?: string | null;
  replaced_by?: string | null;
}

export interface IssuedCardsUpdate {
  id?: string;
  personnel_id?: string | null;
  print_job_id?: string | null;
  qr_code_data?: string;
  rfid_uid?: string | null;
  issued_at?: string;
  expires_at?: string | null;
  status?: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  lost_at?: string | null;
  replaced_by?: string | null;
}

// === delay_entries (migration 068) ===

export interface DelayEntriesRow {
  id: string;
  machine_operation_id: string;
  delay_category_id: string;
  delay_start_time: string;
  delay_end_time: string | null;
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
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DelayEntriesInsert {
  id?: string;
  machine_operation_id: string;
  delay_category_id: string;
  delay_start_time: string;
  delay_end_time?: string | null;
  is_manual_override?: boolean;
  manual_duration_hours?: number | null;
  description?: string | null;
  status?: "draft" | "committed";
  committed_at?: string | null;
  committed_by?: string | null;
  uncommitted_at?: string | null;
  uncommitted_by?: string | null;
  uncommit_reason?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_reason?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DelayEntriesUpdate {
  id?: string;
  machine_operation_id?: string;
  delay_category_id?: string;
  delay_start_time?: string;
  delay_end_time?: string | null;
  is_manual_override?: boolean;
  manual_duration_hours?: number | null;
  description?: string | null;
  status?: "draft" | "committed";
  committed_at?: string | null;
  committed_by?: string | null;
  uncommitted_at?: string | null;
  uncommitted_by?: string | null;
  uncommit_reason?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_reason?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}
