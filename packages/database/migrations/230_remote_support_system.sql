-- ============================================================================
-- Migration 230: Hybrid Two-Tier Remote Support & Desktop Assistance System
-- Purpose:
--   1. Create `public.remote_support_devices` for Tier 2 managed workstations
--      (non-secret metadata only — zero OS passwords persisted).
--   2. Create `public.remote_support_sessions` for Tier 1 (WebRTC browser assist
--      + portal co-browsing) and Tier 2 (OS desktop) session lifecycle.
--   3. Create append-only `public.remote_support_audit_events` with mutation
--      prevention trigger `public.prevent_remote_support_audit_mutation()`.
--   4. Enable Row Level Security (RLS) with InitPlan-wrapped `(SELECT auth.uid())`
--      and `public.employees` role-based policies.
--   5. Register `public.remote_support_sessions` with `supabase_realtime`.
-- ============================================================================

-- ============================================================================
-- 1. Remote Support Managed Devices (Tier 2 Inventory — Zero Stored Secrets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.remote_support_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  device_class TEXT NOT NULL CHECK (
    device_class IN ('workstation', 'laptop', 'scada_hmi', 'unattended_kiosk', 'server')
  ),
  protocol TEXT NOT NULL CHECK (
    protocol IN ('rdp', 'vnc', 'ssh', 'meshcentral')
  ),
  network_host TEXT NOT NULL,
  network_port BIGINT NOT NULL CHECK (network_port >= 1 AND network_port <= 65535),
  protocol_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  require_user_consent BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_devices_site_id
  ON public.remote_support_devices (site_id);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_devices_department_id
  ON public.remote_support_devices (department_id);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_devices_assigned_employee
  ON public.remote_support_devices (assigned_employee_id);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_devices_active
  ON public.remote_support_devices (is_active, hostname);

-- ============================================================================
-- 2. Remote Support Sessions (Tier 1 & Tier 2 Lifecycle)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.remote_support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL UNIQUE CHECK (session_code ~ '^[0-9]{6}$'),
  tier TEXT NOT NULL CHECK (
    tier IN ('tier1_browser', 'tier2_os_desktop')
  ),
  status TEXT NOT NULL CHECK (
    status IN (
      'pending',
      'claimed',
      'consent_requested',
      'active',
      'ended',
      'rejected',
      'expired',
      'revoked'
    )
  ),
  requester_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  agent_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.remote_support_devices(id) ON DELETE SET NULL,
  department_slug TEXT,
  issue_summary TEXT NOT NULL,
  cobrowse_enabled BOOLEAN NOT NULL DEFAULT false,
  consent_granted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  resolution_notes TEXT,
  client_diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_sessions_status_created
  ON public.remote_support_sessions (status, created_at DESC);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_sessions_requester
  ON public.remote_support_sessions (requester_employee_id, created_at DESC);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_sessions_agent
  ON public.remote_support_sessions (agent_employee_id, status);

-- ============================================================================
-- 3. Remote Support Audit Events (Append-Only Immutable Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.remote_support_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.remote_support_sessions(id) ON DELETE RESTRICT,
  actor_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'session_created',
      'session_claimed',
      'consent_requested',
      'consent_granted',
      'consent_rejected',
      'webrtc_connected',
      'cobrowse_requested',
      'cobrowse_granted',
      'cobrowse_revoked',
      'tier2_token_issued',
      'tier2_connected',
      'diagnostics_captured',
      'session_ended',
      'session_revoked',
      'session_expired'
    )
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_audit_events_session
  ON public.remote_support_audit_events (session_id, created_at DESC);

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS idx_remote_support_audit_events_created
  ON public.remote_support_audit_events (created_at DESC);

-- ============================================================================
-- 4. Immutability Trigger for Audit Events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_remote_support_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Remote support audit ledger (%) is append-only; UPDATE and DELETE are prohibited.', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_remote_support_audit_mutation
  ON public.remote_support_audit_events;
CREATE TRIGGER trg_prevent_remote_support_audit_mutation
  BEFORE UPDATE OR DELETE ON public.remote_support_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_remote_support_audit_mutation();

-- ============================================================================
-- 5. Row Level Security (InitPlan-wrapped auth.uid() & employees table)
-- ============================================================================
ALTER TABLE public.remote_support_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_support_audit_events ENABLE ROW LEVEL SECURITY;

-- remote_support_devices policies
DROP POLICY IF EXISTS "remote_support_devices_select_support_staff"
  ON public.remote_support_devices;
CREATE POLICY "remote_support_devices_select_support_staff"
  ON public.remote_support_devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "remote_support_devices_insert_admin"
  ON public.remote_support_devices;
CREATE POLICY "remote_support_devices_insert_admin"
  ON public.remote_support_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "remote_support_devices_update_admin"
  ON public.remote_support_devices;
CREATE POLICY "remote_support_devices_update_admin"
  ON public.remote_support_devices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "remote_support_devices_delete_admin"
  ON public.remote_support_devices;
CREATE POLICY "remote_support_devices_delete_admin"
  ON public.remote_support_devices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND e.role = 'admin'
    )
  );

-- remote_support_sessions policies
DROP POLICY IF EXISTS "remote_support_sessions_select_participant_or_staff"
  ON public.remote_support_sessions;
CREATE POLICY "remote_support_sessions_select_participant_or_staff"
  ON public.remote_support_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.id = requester_employee_id
          OR e.id = agent_employee_id
          OR e.role IN ('admin', 'supervisor')
        )
    )
  );

DROP POLICY IF EXISTS "remote_support_sessions_insert_requester_or_staff"
  ON public.remote_support_sessions;
CREATE POLICY "remote_support_sessions_insert_requester_or_staff"
  ON public.remote_support_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.id = requester_employee_id
          OR e.role IN ('admin', 'supervisor')
        )
    )
  );

DROP POLICY IF EXISTS "remote_support_sessions_update_participant_or_staff"
  ON public.remote_support_sessions;
CREATE POLICY "remote_support_sessions_update_participant_or_staff"
  ON public.remote_support_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.id = requester_employee_id
          OR e.id = agent_employee_id
          OR e.role IN ('admin', 'supervisor')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.id = requester_employee_id
          OR e.id = agent_employee_id
          OR e.role IN ('admin', 'supervisor')
        )
    )
  );

-- remote_support_audit_events policies
DROP POLICY IF EXISTS "remote_support_audit_events_select_participant_or_staff"
  ON public.remote_support_audit_events;
CREATE POLICY "remote_support_audit_events_select_participant_or_staff"
  ON public.remote_support_audit_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.role IN ('admin', 'supervisor')
          OR EXISTS (
            SELECT 1
            FROM public.remote_support_sessions s
            WHERE s.id = session_id
              AND s.requester_employee_id = e.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "remote_support_audit_events_insert_participant"
  ON public.remote_support_audit_events;
CREATE POLICY "remote_support_audit_events_insert_participant"
  ON public.remote_support_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.deleted_at IS NULL
        AND (
          e.role IN ('admin', 'supervisor')
          OR EXISTS (
            SELECT 1
            FROM public.remote_support_sessions s
            WHERE s.id = session_id
              AND s.requester_employee_id = e.id
          )
        )
    )
  );

-- ============================================================================
-- 6. Supabase Realtime Publication Registration
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.remote_support_sessions;
  END IF;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN
    NULL;
END $$;
