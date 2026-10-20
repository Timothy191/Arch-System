-- 187_sync_employees_operators_and_breakdowns.sql
-- Synchronizes Employees to Operators and resolves Breakdown Machine IDs.
-- Ensures employees created in Admin/Access Control automatically populate as Operators
-- for Control Room, Drilling, and Production machine dispatch.

-- 1. Function and Trigger: Sync Employees -> Operators
CREATE OR REPLACE FUNCTION public.sync_employee_to_operators()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Only sync if employee_code is present
  IF NEW.employee_code IS NOT NULL AND trim(NEW.employee_code) != '' THEN
    INSERT INTO public.operators (
      full_name,
      employee_code,
      role,
      active,
      updated_at
    )
    VALUES (
      NEW.full_name,
      NEW.employee_code,
      COALESCE(NEW.role, 'operator'),
      (NEW.deleted_at IS NULL),
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

DROP TRIGGER IF EXISTS trg_sync_employee_to_operators ON public.employees;
CREATE TRIGGER trg_sync_employee_to_operators
  AFTER INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_to_operators();

-- 2. Backfill existing Employees into Operators
INSERT INTO public.operators (full_name, employee_code, role, active, updated_at)
SELECT
  e.full_name,
  e.employee_code,
  COALESCE(e.role, 'operator'),
  (e.deleted_at IS NULL),
  NOW()
FROM public.employees e
WHERE e.employee_code IS NOT NULL AND trim(e.employee_code) != ''
ON CONFLICT (employee_code) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  active = EXCLUDED.active,
  updated_at = NOW();

-- 3. Function and Trigger: Auto-resolve machine_id on Breakdowns
CREATE OR REPLACE FUNCTION public.resolve_breakdown_machine_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.machine_id IS NULL THEN
    SELECT m.id INTO NEW.machine_id
    FROM public.machines m
    WHERE m.name = NEW.fleet_id
       OR m.serial_number = NEW.fleet_id
       OR m.name = NEW.machine_name
       OR m.serial_number = NEW.machine_name
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_breakdown_machine_id ON public.breakdowns;
CREATE TRIGGER trg_resolve_breakdown_machine_id
  BEFORE INSERT OR UPDATE ON public.breakdowns
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_breakdown_machine_id();

-- 4. Backfill existing Breakdowns to link machine_id
UPDATE public.breakdowns b
SET machine_id = m.id
FROM public.machines m
WHERE b.machine_id IS NULL
  AND (
    m.name = b.fleet_id
    OR m.serial_number = b.fleet_id
    OR m.name = b.machine_name
    OR m.serial_number = b.machine_name
  );
