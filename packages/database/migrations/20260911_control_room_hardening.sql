-- Migration: 20260911_control_room_hardening.sql
-- Control Room Hardening & Pre-Production Readiness Migration
-- Integrates pgcrypto PIN verification, supervisor PINs locking table,
-- verify_supervisor_pin RPC function, machines reference table with RLS, and seed data.

-- 1. Enable pgcrypto extension for bcrypt hash verification
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Ensure app_role enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'supervisor', 'control_room_operator', 'operator');
  END IF;
END $$;

-- 3. Create supervisor_pins table
CREATE TABLE IF NOT EXISTS public.supervisor_pins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and deny direct client access
ALTER TABLE public.supervisor_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access" ON public.supervisor_pins;
CREATE POLICY "No direct client access" ON public.supervisor_pins FOR ALL TO public USING (false);

-- 4. Create verify_supervisor_pin SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.verify_supervisor_pin(
  p_user_id UUID,
  p_pin TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT pin_hash, failed_attempts, locked_until INTO v_rec
  FROM public.supervisor_pins
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check lockout condition
  IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > NOW() THEN
    RAISE EXCEPTION 'Account temporarily locked due to excessive failed PIN attempts. Try again later.' USING ERRCODE = 'P0001';
  END IF;

  -- Validate PIN using pgcrypto crypt()
  IF v_rec.pin_hash = crypt(p_pin, v_rec.pin_hash) THEN
    UPDATE public.supervisor_pins
    SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE user_id = p_user_id;
    RETURN TRUE;
  ELSE
    IF v_rec.failed_attempts + 1 >= 3 THEN
      UPDATE public.supervisor_pins
      SET failed_attempts = v_rec.failed_attempts + 1,
          locked_until = NOW() + INTERVAL '5 minutes',
          updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSE
      UPDATE public.supervisor_pins
      SET failed_attempts = v_rec.failed_attempts + 1,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    END IF;
    RETURN FALSE;
  END IF;
END;
$$;

-- 5. Create machines table
CREATE TABLE IF NOT EXISTS public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL DEFAULT 'control_room',
  bin_factor NUMERIC(10,2) NOT NULL DEFAULT 40.50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machines_select_authenticated" ON public.machines;
CREATE POLICY "machines_select_authenticated" ON public.machines
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "machines_update_operators_admins" ON public.machines;
CREATE POLICY "machines_update_operators_admins" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.role IN ('admin', 'supervisor', 'control_room_operator')
    )
  );

-- 6. Seed machines DT-101 and DT-102
INSERT INTO public.machines (name, department, bin_factor, status)
VALUES ('DT-101', 'control_room', 40.50, 'active'),
       ('DT-102', 'control_room', 40.50, 'active')
ON CONFLICT (name) DO UPDATE
SET bin_factor = EXCLUDED.bin_factor,
    status = EXCLUDED.status;
