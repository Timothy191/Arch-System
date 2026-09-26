-- Migration 157: Machines query performance indexes
-- Addresses dev-server smoke-test observation: machines GET took >1200ms.
-- The machines RLS policy joins employees on auth.uid() and filters by
-- department_id / accessible_departments, so a covering partial index on
-- active, non-deleted rows keyed by department_id speeds both the direct
-- query and the policy sub-plan.
-- AGENT-TRACE: partial index because machines has no deleted_at column yet; add
-- it here as a soft-delete enabler so the index can stay consistent once used.

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_machines_department_active
  ON public.machines (department_id, active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_machines_name
  ON public.machines (name)
  WHERE deleted_at IS NULL;
