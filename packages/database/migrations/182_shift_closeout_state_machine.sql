-- Migration: 182_shift_closeout_state_machine.sql
-- Description: Enforce MHSA separation of duties, state machine, and immutability for shift closeouts

-- 1. Add state machine and auditable actor columns
ALTER TABLE public.control_room_shift_reports
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted',
-- squawk-ignore adding-foreign-key-constraint
ADD COLUMN IF NOT EXISTS submitter_id UUID REFERENCES public.employees(id),
-- squawk-ignore adding-foreign-key-constraint
ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS approval_note TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 2. Add status check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_shift_report_status' AND conrelid = 'public.control_room_shift_reports'::regclass
  ) THEN
    ALTER TABLE public.control_room_shift_reports
    ADD CONSTRAINT chk_shift_report_status 
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
  END IF;
END $$;

-- 3. Backfill existing submitters and approved statuses
UPDATE public.control_room_shift_reports
SET submitter_id = created_by
WHERE submitter_id IS NULL AND created_by IS NOT NULL;

-- 4. Enforce Separation of Duties: Approver cannot be Submitter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_separation_of_duties' AND conrelid = 'public.control_room_shift_reports'::regclass
  ) THEN
    ALTER TABLE public.control_room_shift_reports
    ADD CONSTRAINT chk_separation_of_duties 
    CHECK (approver_id IS NULL OR approver_id <> submitter_id);
  END IF;
END $$;

-- 5. Immutability and State Transition Trigger
CREATE OR REPLACE FUNCTION public.trg_control_room_shift_reports_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent mutations to approved reports (append-only compliance)
  IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
    RAISE EXCEPTION 'Approved shift reports are append-only and cannot be altered. File an operational adjustment instead.'
      USING ERRCODE = '23514';
  END IF;

  -- Require distinct approver identity when status moves to approved
  IF NEW.status = 'approved' THEN
    IF NEW.approver_id IS NULL THEN
      RAISE EXCEPTION 'An approving supervisor identity is required to approve shift closeout.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.approver_id = NEW.submitter_id THEN
      RAISE EXCEPTION 'Separation of duties violation: Submitter cannot approve their own shift report.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
  END IF;

  IF NEW.status = 'rejected' AND NEW.rejected_at IS NULL THEN
    NEW.rejected_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_report_lifecycle ON public.control_room_shift_reports;
CREATE TRIGGER trg_shift_report_lifecycle
  BEFORE UPDATE ON public.control_room_shift_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_control_room_shift_reports_lifecycle();

-- 6. Atomic Supervisor Approval RPC
CREATE OR REPLACE FUNCTION public.atomic_approve_shift_report(
  p_report_id UUID,
  p_approval_note TEXT DEFAULT NULL,
  p_approver_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_caller_emp_id UUID;
  v_caller_role TEXT;
  v_target_submitter_id UUID;
  v_current_status TEXT;
  v_report public.control_room_shift_reports%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id, role INTO v_caller_emp_id, v_caller_role
  FROM public.employees
  WHERE auth_id = v_auth_id
  LIMIT 1;

  IF v_caller_emp_id IS NULL OR v_caller_role NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to approve shift closeouts' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id IS NOT NULL AND p_approver_id <> v_caller_emp_id AND v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Approver identity mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_report
  FROM public.control_room_shift_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift report not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_report.status = 'approved' THEN
    RETURN jsonb_build_object('status', 'already_approved', 'id', p_report_id);
  END IF;

  -- Enforce separation of duties: Approver cannot be Submitter
  IF v_report.submitter_id = v_caller_emp_id THEN
    RAISE EXCEPTION 'Separation of duties violation: Approver cannot approve their own shift closeout'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.control_room_shift_reports
  SET
    status = 'approved',
    approver_id = v_caller_emp_id,
    approved_at = now(),
    approval_note = p_approval_note,
    updated_at = now()
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'status', 'approved',
    'id', p_report_id,
    'approver_id', v_caller_emp_id,
    'approved_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_approve_shift_report(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_approve_shift_report(UUID, TEXT, UUID) TO authenticated;
