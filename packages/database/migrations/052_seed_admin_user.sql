-- ============================================
-- Seed Data: System Administrator Account
-- ============================================

DO $$
DECLARE
  admin_uid UUID;
  dept_ids UUID[];
BEGIN
  -- Enable pgcrypto if it's not already enabled (required for crypt and gen_salt)
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- 1. Create or update the user in auth.users
  SELECT id INTO admin_uid FROM auth.users WHERE email ILIKE 'admin@plantcor.os';

  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      aud,
      role,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      'admin@plantcor.os',
      crypt('Yugioh@123#', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );
  ELSE
    -- If exists, update password and ensure email capitalization is Admin@plantcor.os
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Yugioh@123#', gen_salt('bf')),
      email = 'admin@plantcor.os'
    WHERE id = admin_uid;
  END IF;

  -- 2. Ensure they exist in public.employees with full admin rights
  SELECT array_agg(id) INTO dept_ids FROM departments;

  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE auth_id = admin_uid) THEN
    INSERT INTO public.employees (
      auth_id,
      full_name,
      role,
      accessible_departments
    ) VALUES (
      admin_uid,
      'System Administrator',
      'admin',
      dept_ids
    );
  ELSE
    UPDATE public.employees
    SET role = 'admin',
        accessible_departments = dept_ids
    WHERE auth_id = admin_uid;
  END IF;

END $$;
