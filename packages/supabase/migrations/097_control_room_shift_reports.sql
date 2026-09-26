-- 096_control_room_shift_reports.sql
-- Control Room Shift Reports
-- Persists operator shift closeout reports: KPI metrics, checklist state,
-- and supervisor signature. One report per (department, date, shift).

-- AGENT-TRACE: Backing table for ControlRoomChecklistWidget submit path.
-- Columns mirror @repo/contract controlRoomShiftReportSchema; checklist_items
-- stores the full checklist state as JSONB for auditability.

-- ============================================================================
-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.control_room_shift_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'night')),
  operator_name TEXT NOT NULL,
  alarm_response_avg_seconds NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (alarm_response_avg_seconds >= 0),
  incident_ack_avg_seconds NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (incident_ack_avg_seconds >= 0),
  system_uptime_percent NUMERIC(5,2) NOT NULL DEFAULT 100
    CHECK (system_uptime_percent >= 0 AND system_uptime_percent <= 100),
  missed_incidents_count INTEGER NOT NULL DEFAULT 0 CHECK (missed_incidents_count >= 0),
  summary_notes TEXT,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_checklist_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_checklist_count >= 0),
  total_checklist_count INTEGER NOT NULL DEFAULT 0 CHECK (total_checklist_count >= 0),
  supervisor_signature TEXT,
  created_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, report_date, shift_type)
);

-- ============================================================================
-- 2. Row Level Security
-- ============================================================================
ALTER TABLE public.control_room_shift_reports ENABLE ROW LEVEL SECURITY;

-- Department-scoped access: admins see all, employees see own/accessible departments.
CREATE POLICY "control_room_shift_reports_select_department"
  ON public.control_room_shift_reports
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  );

CREATE POLICY "control_room_shift_reports_insert_department"
  ON public.control_room_shift_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  );

CREATE POLICY "control_room_shift_reports_update_department"
  ON public.control_room_shift_reports
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
  );

-- ============================================================================
-- 3. updated_at trigger
-- ============================================================================
CREATE TRIGGER control_room_shift_reports_updated_at
  BEFORE UPDATE ON public.control_room_shift_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
