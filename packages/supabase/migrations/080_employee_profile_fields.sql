-- Migration 080: Employee Profile Fields
-- Adds required fields to the employees table for the Architecture and Data Layer phase.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS national_id TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS areas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS medical_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS induction_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Update existing data: populate first_name and last_name from full_name
UPDATE employees
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = substring(full_name from (length(split_part(full_name, ' ', 1)) + 2))
WHERE full_name IS NOT NULL AND first_name IS NULL;

-- Update the enforce_employee_update_constraints function to protect the new fields
CREATE OR REPLACE FUNCTION public.enforce_employee_update_constraints()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the updater is not a system administrator, prevent changing key identity and access columns
  IF NOT public.is_admin() THEN
    NEW.role := OLD.role;
    NEW.department_id := OLD.department_id;
    NEW.accessible_departments := OLD.accessible_departments;
    NEW.auth_id := OLD.auth_id;
    
    -- Protect new sensitive profile fields from self-update
    NEW.national_id := OLD.national_id;
    NEW.employee_code := OLD.employee_code;
    NEW.job_title := OLD.job_title;
    NEW.medical_expiry_date := OLD.medical_expiry_date;
    NEW.induction_expiry_date := OLD.induction_expiry_date;
    NEW.qr_code_data := OLD.qr_code_data;
    NEW.areas := OLD.areas;
  END IF;
  RETURN NEW;
END;
$$;
