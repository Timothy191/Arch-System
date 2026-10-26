-- 206_integration_rls_hardening.sql
-- Hardens integration platform RLS and constraints per Phase 2 baseline audit.
--
-- 1. Restrict integration_audit_logs INSERT to service role only (drop WITH CHECK (true)).
-- 2. Add FKs for installed_by / invoked_by -> auth.users(id) (best-effort).
-- 3. Add unique index preventing duplicate installations per scope/department (NULL-safe).
-- 4. Add index on (installation_id, created_at DESC) for audit log reads.

-- 1. Drop overly permissive audit log insert policy
DROP POLICY IF EXISTS "runtime_insert_integration_audit_logs" ON integration_audit_logs;

-- Service-role (bypasses RLS) remains the only writer. No replacement policy
-- is added so user-scoped sessions cannot insert audit rows.

-- 2. Foreign keys: installed_by / invoked_by store Supabase auth.users.id
--    (see route.ts handleInstall and test route), so reference auth.users(id).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_installations' AND column_name = 'installed_by'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    BEGIN
      ALTER TABLE integration_installations
        ADD CONSTRAINT integration_installations_installed_by_fk
        FOREIGN KEY (installed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_audit_logs' AND column_name = 'invoked_by'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    BEGIN
      ALTER TABLE integration_audit_logs
        ADD CONSTRAINT integration_audit_logs_invoked_by_fk
        FOREIGN KEY (invoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 3. Prevent duplicate installations per scope/department (NULL-safe via COALESCE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'integration_installations_unique_scope'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS integration_installations_unique_scope
      ON integration_installations (
        catalog_id,
        scope,
        COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
      );
  END IF;
END $$;

-- 4. Index for audit log reads
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_installation_created
  ON integration_audit_logs (installation_id, created_at DESC);
