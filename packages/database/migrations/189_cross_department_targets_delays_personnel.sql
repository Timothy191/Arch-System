-- 189_cross_department_targets_delays_personnel.sql
-- 1. Monthly Production Targets (Coal, Waste, BCM) shared across Production, Control Room, and Drilling
-- 2. Engineering Breakdown Shift Delay Hours (shared 12-hour shift cap with Control Room)
-- 3. Access Control Personnel -> Operators automatic synchronization trigger

-- ============================================================================
-- 1. Monthly Production Targets Table (SSoT for Waste & Coal Monthly Targets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.production_monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_month TEXT NOT NULL UNIQUE CHECK (target_month ~ '^[0-9]{4}-[0-9]{2}$'),
  coal_target_tonnes NUMERIC(14, 2) NOT NULL DEFAULT 125000 CHECK (coal_target_tonnes >= 0),
  waste_target_tonnes NUMERIC(14, 2) NOT NULL DEFAULT 350000 CHECK (waste_target_tonnes >= 0),
  bcm_target NUMERIC(14, 2) NOT NULL DEFAULT 160000 CHECK (bcm_target >= 0),
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_monthly_targets_month
  ON public.production_monthly_targets(target_month DESC);

ALTER TABLE public.production_monthly_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "production_monthly_targets_select_authenticated" ON public.production_monthly_targets;
CREATE POLICY "production_monthly_targets_select_authenticated"
  ON public.production_monthly_targets
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "production_monthly_targets_write_authorized" ON public.production_monthly_targets;
CREATE POLICY "production_monthly_targets_write_authorized"
  ON public.production_monthly_targets
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Seed baseline monthly targets for current and past months
INSERT INTO public.production_monthly_targets (
  target_month,
  coal_target_tonnes,
  waste_target_tonnes,
  bcm_target,
  notes
)
VALUES
  ('2026-08', 120000, 336000, 152000, 'August 2026 Opencast ROM & Overburden Target'),
  ('2026-09', 125000, 350000, 160000, 'September 2026 Opencast ROM & Overburden Target'),
  ('2026-10', 130000, 364000, 168000, 'October 2026 Opencast ROM & Overburden Target'),
  ('2026-11', 135000, 378000, 175000, 'November 2026 Opencast ROM & Overburden Target')
ON CONFLICT (target_month) DO NOTHING;

-- ============================================================================
-- 2. Engineering Breakdown Shift Delay Hours (12-Hour Shift Cap Sync)
-- ============================================================================
ALTER TABLE public.breakdowns
  ADD COLUMN IF NOT EXISTS delay_hours NUMERIC(5, 2) DEFAULT 0 CHECK (delay_hours >= 0 AND delay_hours <= 12),
  ADD COLUMN IF NOT EXISTS shift_type TEXT DEFAULT 'day' CHECK (shift_type IN ('day', 'night')),
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Trigger to auto-calculate shift_type and default delay_hours on breakdowns
CREATE OR REPLACE FUNCTION public.compute_breakdown_shift_delay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hour INT;
  v_diff_hours NUMERIC(5, 2);
BEGIN
  -- Infer shift_type from time_in if not explicitly provided
  IF NEW.time_in IS NOT NULL AND length(trim(NEW.time_in)) >= 2 THEN
    BEGIN
      v_hour := substring(trim(NEW.time_in) FROM 1 FOR 2)::INT;
      IF v_hour >= 6 AND v_hour < 18 THEN
        NEW.shift_type := COALESCE(NEW.shift_type, 'day');
      ELSE
        NEW.shift_type := COALESCE(NEW.shift_type, 'night');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NEW.shift_type := COALESCE(NEW.shift_type, 'day');
    END;
  END IF;

  -- If date_out and time_out are provided and delay_hours is 0/null, compute bounded 12h delay
  IF (NEW.delay_hours IS NULL OR NEW.delay_hours = 0)
     AND NEW.date_in IS NOT NULL AND NEW.time_in IS NOT NULL
     AND NEW.date_out IS NOT NULL AND NEW.time_out IS NOT NULL THEN
    BEGIN
      v_diff_hours := EXTRACT(EPOCH FROM (
        (NEW.date_out || ' ' || NEW.time_out)::TIMESTAMP -
        (NEW.date_in || ' ' || NEW.time_in)::TIMESTAMP
      )) / 3600.0;
      IF v_diff_hours > 0 THEN
        NEW.delay_hours := LEAST(12.0, ROUND(v_diff_hours, 2));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Keep existing delay_hours
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_breakdown_shift_delay ON public.breakdowns;
CREATE TRIGGER trg_compute_breakdown_shift_delay
  BEFORE INSERT OR UPDATE ON public.breakdowns
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_breakdown_shift_delay();

-- ============================================================================
-- 3. Access Control Personnel -> Operators Synchronization Trigger
-- ============================================================================
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE OR REPLACE FUNCTION public.sync_personnel_to_operators()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.emp_code IS NOT NULL AND trim(NEW.emp_code) != '' THEN
    INSERT INTO public.operators (
      full_name,
      employee_code,
      role,
      active,
      updated_at
    )
    VALUES (
      trim(NEW.first_name || ' ' || NEW.surname),
      trim(NEW.emp_code),
      COALESCE(NEW.job_title, 'operator'),
      (LOWER(COALESCE(NEW.status, 'active')) = 'active'),
      NOW()
    )
    ON CONFLICT (employee_code) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      active = EXCLUDED.active,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_personnel_to_operators ON public.personnel;
CREATE TRIGGER trg_sync_personnel_to_operators
  AFTER INSERT OR UPDATE ON public.personnel
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_personnel_to_operators();
