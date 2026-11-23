-- Migration 228: Add Employee Profile Fields (gender, date_of_birth, record_type)
-- Description: Adds optional gender ('male' | 'female' | 'other'), date_of_birth (DATE),
--              and record_type ('user' | 'employee') columns to public.employees and
--              public.personnel using zero-lock NOT VALID check constraints.
-- rls-exempt: alters existing RLS-protected tables public.employees and public.personnel

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS record_type TEXT;

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS record_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_employees_gender'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT chk_employees_gender
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_employees_record_type'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT chk_employees_record_type
      CHECK (record_type IS NULL OR record_type IN ('user', 'employee')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_personnel_gender'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT chk_personnel_gender
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_personnel_record_type'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT chk_personnel_record_type
      CHECK (record_type IS NULL OR record_type IN ('user', 'employee')) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.employees VALIDATE CONSTRAINT chk_employees_gender;
ALTER TABLE public.employees VALIDATE CONSTRAINT chk_employees_record_type;
ALTER TABLE public.personnel VALIDATE CONSTRAINT chk_personnel_gender;
ALTER TABLE public.personnel VALIDATE CONSTRAINT chk_personnel_record_type;

COMMENT ON COLUMN public.employees.gender IS 'Optional employee gender: male, female, or other.';
COMMENT ON COLUMN public.employees.date_of_birth IS 'Optional employee birthday (YYYY-MM-DD).';
COMMENT ON COLUMN public.employees.record_type IS 'Account record classification: user (portal access) or employee (staff record).';

COMMENT ON COLUMN public.personnel.gender IS 'Optional personnel gender: male, female, or other.';
COMMENT ON COLUMN public.personnel.date_of_birth IS 'Optional personnel birthday (YYYY-MM-DD).';
COMMENT ON COLUMN public.personnel.record_type IS 'Account record classification: user (portal access) or employee (staff record).';
