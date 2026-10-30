-- Migration 213: Monthly Machine Activity Snapshots for Safe Cloud Archiving
-- Purpose: Persist sealed monthly machine activity tables, SMR totals, 12-delay category rollups,
-- and executive summary data in PostgreSQL for long-term CEO and executive reporting.

CREATE TABLE IF NOT EXISTS public.monthly_machine_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  shift_type TEXT NOT NULL DEFAULT 'all',
  machine_count BIGINT NOT NULL DEFAULT 0,
  total_smr_worked NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  fleet_availability_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  fleet_utilization_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  total_breakdown_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_sealed BOOLEAN NOT NULL DEFAULT true,
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  sealed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  records JSONB NOT NULL DEFAULT '[]'::jsonb,
  summaries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_monthly_machine_snapshots UNIQUE (department_id, month, shift_type)
);

-- Indexes for lightning fast queries across executive dashboards and audit lookups
CREATE INDEX IF NOT EXISTS idx_monthly_machine_snapshots_dept_month
  ON public.monthly_machine_snapshots (department_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_machine_snapshots_month
  ON public.monthly_machine_snapshots (month DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.monthly_machine_snapshots ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Authenticated users can view monthly snapshots within their accessible departments
CREATE POLICY "Employees can view monthly machine snapshots"
  ON public.monthly_machine_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid()
        AND (
          e.role IN ('system_admin', 'executive', 'auditor')
          OR e.department_id = monthly_machine_snapshots.department_id
          OR EXISTS (
            SELECT 1 FROM public.employee_departments ed
            WHERE ed.employee_id = e.id
              AND ed.department_id = monthly_machine_snapshots.department_id
          )
        )
    )
  );

-- 2. Insert/Update Policy: Authorized managers, supervisors and admins can archive & seal snapshots
CREATE POLICY "Supervisors and admins can manage monthly machine snapshots"
  ON public.monthly_machine_snapshots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid()
        AND (
          e.role IN ('system_admin', 'executive', 'admin', 'supervisor', 'manager')
          OR (
            e.department_id = monthly_machine_snapshots.department_id
            AND e.role IN ('engineer', 'shift_boss')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid()
        AND (
          e.role IN ('system_admin', 'executive', 'admin', 'supervisor', 'manager')
          OR (
            e.department_id = monthly_machine_snapshots.department_id
            AND e.role IN ('engineer', 'shift_boss')
          )
        )
    )
  );
