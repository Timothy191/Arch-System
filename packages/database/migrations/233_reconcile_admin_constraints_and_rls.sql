-- ============================================================================
-- Migration: 233_reconcile_admin_constraints_and_rls.sql
-- Purpose:
--   1. Fix operators_role_check mismatch in public.sync_employee_to_operators()
--      so Admin / Control Room / Access Control / Viewer / Maintenance roles
--      map cleanly to ('operator', 'supervisor', 'trainer', 'relief').
--   2. Widen machines_machine_type_check to include 'Articulated Dumper' and
--      'Rigid Dumper' (matching FleetTab options).
--   3. Widen employees_role_check to include 'manager' (matching proxy.ts).
--   4. Enforce deleted_at IS NULL in is_admin(), has_department_access(),
--      get_employee_department(), and can_access_department(), and wire
--      can_access_department(..., 'operate') onto operational write RLS policies
--      so Read Only department grants cannot mutate operational tables.
--   5. Reconcile storage.objects ('card-templates') UPDATE/DELETE RLS policies,
--      remove stale access_control write policies on public.card_templates, and
--      drop duplicate policies on public.sites.
--   6. Harden RLS on public.ai_token_usage, public.audit_logs, and
--      public.slo_metrics.
--   7. Add SECURITY DEFINER RPCs: public.get_ai_token_usage_summary() and
--      public.match_external_content_documents().
--   8. Register public.remote_support_audit_events in supabase_realtime and
--      guard private support:session:* realtime.messages RLS.
-- ============================================================================

-- ============================================================================
-- 1. Reconcile sync_employee_to_operators() role mapping (SLICE-A-002)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_employee_to_operators()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_operator_role TEXT;
BEGIN
  IF NEW.employee_code IS NOT NULL AND trim(NEW.employee_code) != '' THEN
    v_operator_role := CASE
      WHEN NEW.role IN ('supervisor', 'admin', 'manager') THEN 'supervisor'
      WHEN NEW.role IN ('trainer', 'relief') THEN NEW.role
      ELSE 'operator'
    END;

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
      v_operator_role,
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

-- ============================================================================
-- 2. Widen machines_machine_type_check (SLICE-A-003)
-- ============================================================================
ALTER TABLE public.machines
  -- squawk-ignore ban-drop-constraint
  DROP CONSTRAINT IF EXISTS machines_machine_type_check;

ALTER TABLE public.machines
  ADD CONSTRAINT machines_machine_type_check
  CHECK (machine_type IN (
    'Articulated Dumper', 'Rigid Dumper',
    'Drill Rig', 'Dump Truck', 'Excavator', 'Generator',
    'Dozer', 'Grader', 'Loader', 'Water Truck', 'Light Vehicle',
    'Compactor', 'Crusher', 'Screen', 'Conveyor', 'Pump',
    'Transformer', 'Switchgear', 'Other'
  )) NOT VALID;

-- ============================================================================
-- 3. Widen employees_role_check to include 'manager' (SLICE-A-009)
-- ============================================================================
ALTER TABLE public.employees
  -- squawk-ignore ban-drop-constraint
  DROP CONSTRAINT IF EXISTS employees_role_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_role_check
  CHECK (role IN (
    'operator',
    'supervisor',
    'admin',
    'viewer',
    'manager',
    'control_room_operator',
    'access_control',
    'maintenance'
  )) NOT VALID;

-- ============================================================================
-- 4. Soft-delete & Read-Only vs Write Department Enforcement (SLICE-A-004/005)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_department_access(dept_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_id = (SELECT auth.uid())
      AND deleted_at IS NULL
      AND (
        role = 'admin'
        OR department_id = dept_id
        OR dept_id = ANY(accessible_departments)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_employee_department()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id
  FROM public.employees
  WHERE auth_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_department(
  p_department_id UUID,
  p_level public.department_access_level DEFAULT 'read'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := (SELECT auth.uid());
  v_emp_id UUID;
  v_role TEXT;
  v_home_dept UUID;
  v_access_level public.department_access_level;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id, role, department_id
  INTO v_emp_id, v_role, v_home_dept
  FROM public.employees
  WHERE auth_id = v_auth_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_emp_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_home_dept = p_department_id THEN
    IF p_level = 'read' THEN
      RETURN TRUE;
    END IF;
    IF p_level = 'operate' AND v_role != 'viewer' THEN
      RETURN TRUE;
    END IF;
    IF p_level = 'supervise' AND v_role IN ('supervisor', 'manager') THEN
      RETURN TRUE;
    END IF;
    IF p_level = 'manage' AND v_role IN ('supervisor', 'manager') THEN
      RETURN TRUE;
    END IF;
  END IF;

  SELECT access_level
  INTO v_access_level
  FROM public.employee_department_access
  WHERE employee_id = v_emp_id
    AND department_id = p_department_id
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_access_level IS NOT NULL THEN
    IF p_level = 'read' THEN
      RETURN TRUE;
    END IF;
    IF p_level = 'operate' AND v_access_level IN ('operate', 'supervise', 'manage') THEN
      RETURN TRUE;
    END IF;
    IF p_level = 'supervise' AND v_access_level IN ('supervise', 'manage') THEN
      RETURN TRUE;
    END IF;
    IF p_level = 'manage' AND v_access_level = 'manage' THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

DROP POLICY IF EXISTS "machines_insert_admin_supervisor" ON public.machines;
CREATE POLICY "machines_insert_admin_supervisor" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR public.can_access_department(department_id, 'operate')
  );

DROP POLICY IF EXISTS "machines_update_admin_supervisor" ON public.machines;
CREATE POLICY "machines_update_admin_supervisor" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_admin())
    OR public.can_access_department(department_id, 'operate')
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR public.can_access_department(department_id, 'operate')
  );

DROP POLICY IF EXISTS "daily_logs_insert_department" ON public.daily_logs;
CREATE POLICY "daily_logs_insert_department" ON public.daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR public.can_access_department(department_id, 'operate')
  );

DROP POLICY IF EXISTS "machine_hours_insert_department" ON public.machine_hours;
CREATE POLICY "machine_hours_insert_department" ON public.machine_hours
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR public.can_access_department(
      (SELECT dl.department_id FROM public.daily_logs dl WHERE dl.id = daily_log_id),
      'operate'
    )
  );

-- ============================================================================
-- 5. Card Templates Storage & Table RLS + Duplicate Sites Policies (SLICE-A-007)
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin update card-templates objects" ON storage.objects;
    CREATE POLICY "Admin update card-templates objects" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'card-templates' AND (SELECT public.is_admin()))
      WITH CHECK (bucket_id = 'card-templates' AND (SELECT public.is_admin()));

    DROP POLICY IF EXISTS "Admin delete card-templates objects" ON storage.objects;
    CREATE POLICY "Admin delete card-templates objects" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'card-templates' AND (SELECT public.is_admin()));
  END IF;
END $$;

DROP POLICY IF EXISTS "Allow access control insert card_templates" ON public.card_templates;
DROP POLICY IF EXISTS "Allow access control update card_templates" ON public.card_templates;

DROP POLICY IF EXISTS "sites_insert_admin" ON public.sites;
DROP POLICY IF EXISTS "sites_update_admin" ON public.sites;

-- ============================================================================
-- 6. Harden RLS on ai_token_usage, audit_logs, and slo_metrics (SLICE-C-01/02)
-- ============================================================================
DROP POLICY IF EXISTS "ai_token_usage_server_insert" ON public.ai_token_usage;
REVOKE INSERT ON public.ai_token_usage FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "ai_token_usage_user_select" ON public.ai_token_usage;
CREATE POLICY "ai_token_usage_user_select" ON public.ai_token_usage
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "ai_token_usage_admin_select" ON public.ai_token_usage;
CREATE POLICY "ai_token_usage_admin_select" ON public.ai_token_usage
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = (
      SELECT e.id
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "authenticated_can_read_slo_metrics" ON public.slo_metrics;
CREATE POLICY "authenticated_can_read_slo_metrics" ON public.slo_metrics
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- ============================================================================
-- 7. Exact AI Token Usage Summary RPC (SLICE-C-08)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_ai_token_usage_summary(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT
      model_name,
      total_tokens,
      prompt_tokens,
      completion_tokens,
      total_cost_usd_cents,
      latency_ms,
      status
    FROM public.ai_token_usage
    WHERE p_since IS NULL OR created_at >= p_since
  ),
  agg AS (
    SELECT
      COUNT(*)::INT AS total_requests,
      COALESCE(SUM(total_tokens), 0)::BIGINT AS total_tokens,
      COALESCE(SUM(prompt_tokens), 0)::BIGINT AS total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0)::BIGINT AS total_completion_tokens,
      COALESCE(SUM(total_cost_usd_cents), 0)::BIGINT AS total_cost_usd_cents,
      COALESCE(ROUND(AVG(latency_ms))::INT, 0) AS avg_latency_ms,
      COUNT(*) FILTER (WHERE status = 'error')::INT AS error_count
    FROM filtered
  ),
  per_model AS (
    SELECT
      model_name,
      COUNT(*)::INT AS requests,
      COALESCE(SUM(total_tokens), 0)::BIGINT AS tokens,
      COALESCE(SUM(total_cost_usd_cents), 0)::BIGINT AS cost_usd_cents,
      COALESCE(ROUND(AVG(latency_ms))::INT, 0) AS avg_latency_ms
    FROM filtered
    GROUP BY model_name
    ORDER BY tokens DESC
  )
  SELECT jsonb_build_object(
    'total_requests', agg.total_requests,
    'total_tokens', agg.total_tokens,
    'total_prompt_tokens', agg.total_prompt_tokens,
    'total_completion_tokens', agg.total_completion_tokens,
    'total_cost_usd_cents', agg.total_cost_usd_cents,
    'avg_latency_ms', agg.avg_latency_ms,
    'error_count', agg.error_count,
    'by_model', COALESCE(
      (SELECT jsonb_agg(to_jsonb(per_model)) FROM per_model),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM agg;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_token_usage_summary(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_token_usage_summary(TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 8. External Content Tenant-Wide Vector Search RPC (SLICE-B-05)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_external_content_documents(
  query_embedding extensions.vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    me.id,
    me.content,
    me.metadata,
    (1 - (me.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.memory_embeddings me
  WHERE me.session_id = 'external_content'
    AND (1 - (me.embedding <=> query_embedding)) >= match_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
END;
$$;

REVOKE ALL ON FUNCTION public.match_external_content_documents(extensions.vector(768), FLOAT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_external_content_documents(extensions.vector(768), FLOAT, INT) TO authenticated;

-- ============================================================================
-- 9. Remote Support Realtime Publication & Private Broadcast RLS (RS-05/RS-06)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'remote_support_audit_events'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.remote_support_audit_events;
  END IF;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN
    NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "remote_support_realtime_broadcast_select" ON realtime.messages';
    EXECUTE '
      CREATE POLICY "remote_support_realtime_broadcast_select" ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        topic NOT LIKE ''support:session:%''
        OR EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.auth_id = (SELECT auth.uid())
            AND e.deleted_at IS NULL
            AND (
              e.role IN (''admin'', ''supervisor'')
              OR EXISTS (
                SELECT 1
                FROM public.remote_support_sessions s
                WHERE ''support:session:'' || s.id::text = topic
                  AND (s.requester_employee_id = e.id OR s.agent_employee_id = e.id)
              )
            )
        )
      )
    ';
    EXECUTE 'DROP POLICY IF EXISTS "remote_support_realtime_broadcast_insert" ON realtime.messages';
    EXECUTE '
      CREATE POLICY "remote_support_realtime_broadcast_insert" ON realtime.messages
      FOR INSERT TO authenticated
      WITH CHECK (
        topic NOT LIKE ''support:session:%''
        OR EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.auth_id = (SELECT auth.uid())
            AND e.deleted_at IS NULL
            AND (
              e.role IN (''admin'', ''supervisor'')
              OR EXISTS (
                SELECT 1
                FROM public.remote_support_sessions s
                WHERE ''support:session:'' || s.id::text = topic
                  AND (s.requester_employee_id = e.id OR s.agent_employee_id = e.id)
              )
            )
        )
      )
    ';
  END IF;
END $$;
