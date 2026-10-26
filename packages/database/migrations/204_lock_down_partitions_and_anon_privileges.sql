-- ============================================
-- Migration: 204_lock_down_partitions_and_anon_privileges
-- Description:
--   1. Enables ROW LEVEL SECURITY on every partition of every partitioned
--      table in public, driven by a recursive catalog walk over pg_inherits
--      (no hardcoded partition names) and on the partitioned parents
--      themselves.
--   2. Revokes every unauthenticated (anon) table/sequence privilege in
--      public, plus one explicit REVOKE per partition.
--   3. Stops default privileges from re-granting anon on future objects.
--
--   Children receive no policies on purpose: direct access to a partition is
--   denied for authenticated, while access through the parent keeps using the
--   parent's existing department/admin policies (verified: parent reads are
--   unaffected, direct child reads return zero rows).
--
--   No anon-facing view or RPC is retained. Every PostgREST call in the app
--   runs as authenticated or service_role; the only pre-login network
--   dependency is the Realtime websocket probe, which does not read public
--   tables.
--
-- Idempotent: all DDL is catalog-guarded and repeated REVOKEs are no-ops.
--
-- Rollback (re-opens unauthenticated access; emergency revert only):
--   Per partition: ALTER TABLE public.<partition> DISABLE ROW LEVEL SECURITY;
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
--   Restoring the pre-migration pg_dump is preferred to the above.
-- ============================================

-- ============================================
-- 1. RLS on every partition + explicit anon revoke per partition
--    relkind = 'p' is a partitioned table; 'I' (partitioned index) is filtered
--    out because pg_inherits also links index children to their parent index.
-- ============================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH RECURSIVE parts(relid) AS (
      SELECT c.oid
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'p'
      UNION
      SELECT child.oid
      FROM pg_inherits i
      JOIN pg_class child ON child.oid = i.inhrelid
      JOIN parts p ON p.relid = i.inhparent
      WHERE child.relkind IN ('r', 'p')
    )
    SELECT c.oid AS relid, n.nspname, c.relname, c.relrowsecurity
    FROM parts
    JOIN pg_class c ON c.oid = parts.relid
    JOIN pg_namespace n ON n.oid = c.relnamespace
  LOOP
    IF NOT r.relrowsecurity THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.nspname, r.relname);
      RAISE NOTICE '204: enabled RLS on %.%', r.nspname, r.relname;
    END IF;

    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', r.nspname, r.relname);
  END LOOP;
END $$;

-- ============================================
-- 2. Revoke existing anon privileges on every current public object
--    (ALL TABLES covers tables, views, materialized views and foreign tables)
-- ============================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ============================================
-- 3. Stop future objects from re-granting anon
-- ============================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ============================================
-- 4. Self-verification: fail the migration if any public partition still has
--    RLS disabled or anon still holds SELECT on any public relation
-- ============================================
DO $$
DECLARE
  v_missing_rls int;
  v_anon_select int;
BEGIN
  WITH RECURSIVE parts(relid) AS (
    SELECT c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'p'
    UNION
    SELECT child.oid
    FROM pg_inherits i
    JOIN pg_class child ON child.oid = i.inhrelid
    JOIN parts p ON p.relid = i.inhparent
    WHERE child.relkind IN ('r', 'p')
  )
  SELECT count(*)
  INTO v_missing_rls
  FROM parts
  JOIN pg_class c ON c.oid = parts.relid
  WHERE NOT c.relrowsecurity;

  IF v_missing_rls > 0 THEN
    RAISE EXCEPTION '204: % public partition(s) still have RLS disabled', v_missing_rls;
  END IF;

  SELECT count(*)
  INTO v_anon_select
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND has_table_privilege('anon', c.oid, 'SELECT');

  IF v_anon_select > 0 THEN
    RAISE EXCEPTION '204: anon still holds SELECT on % public relation(s)', v_anon_select;
  END IF;
END $$;

-- ============================================
-- CI lint (run separately, not in the migration):
--   Fails when any partitioned table in public has a child without RLS.
--
--   SELECT parent.oid::regclass::text AS partitioned_table,
--          child.oid::regclass::text  AS partition
--   FROM pg_inherits i
--   JOIN pg_class parent     ON parent.oid = i.inhparent
--   JOIN pg_namespace pn     ON pn.oid = parent.relnamespace
--   JOIN pg_class child      ON child.oid = i.inhrelid
--   WHERE pn.nspname = 'public'
--     AND parent.relkind = 'p'
--     AND child.relkind IN ('r', 'p')
--     AND NOT child.relrowsecurity
--   ORDER BY 1, 2;
-- ============================================
