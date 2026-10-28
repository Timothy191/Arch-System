-- Backfill department_id for seeded plant_inventory_items rows (migration 205 seeded with NULL)
UPDATE public.plant_inventory_items
SET department_id = (SELECT id FROM public.departments WHERE name = 'plant-inventory' LIMIT 1)
WHERE department_id IS NULL;

-- 212_harden_plant_and_muster_rls.sql
-- Remediate tautological RLS policies from migration 205 that allowed any
-- authenticated user to read/write/delete plant and muster data across all departments.

-- 1. plant_inventory_items (department_id present, nullable for legacy rows)
DROP POLICY IF EXISTS "plant_inventory_items_select" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_select"
  ON public.plant_inventory_items FOR SELECT
  TO authenticated
  USING (
    department_id IS NULL
    OR public.has_department_access(department_id)
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "plant_inventory_items_insert" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_insert"
  ON public.plant_inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "plant_inventory_items_update" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_update"
  ON public.plant_inventory_items FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "plant_inventory_items_delete" ON public.plant_inventory_items;
CREATE POLICY "plant_inventory_items_delete"
  ON public.plant_inventory_items FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- 2. plant_inventory_usage (no department_id; scoped to plant-inventory department via item_id FK)
DROP POLICY IF EXISTS "plant_inventory_usage_select" ON public.plant_inventory_usage;
CREATE POLICY "plant_inventory_usage_select"
  ON public.plant_inventory_usage FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.plant_inventory_items pi
      WHERE pi.id = plant_inventory_usage.item_id
        AND public.has_department_access(pi.department_id)
    )
    OR (plant_inventory_usage.item_id IS NULL)
  );

DROP POLICY IF EXISTS "plant_inventory_usage_insert" ON public.plant_inventory_usage;
CREATE POLICY "plant_inventory_usage_insert"
  ON public.plant_inventory_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.plant_inventory_items pi
      WHERE pi.id = plant_inventory_usage.item_id
        AND public.has_department_access(pi.department_id)
    )
  );

-- 3. plant_hourly_logs (department_id present)
DROP POLICY IF EXISTS "plant_hourly_logs_select" ON public.plant_hourly_logs;
CREATE POLICY "plant_hourly_logs_select"
  ON public.plant_hourly_logs FOR SELECT
  TO authenticated
  USING (
    department_id IS NULL
    OR public.has_department_access(department_id)
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "plant_hourly_logs_insert" ON public.plant_hourly_logs;
CREATE POLICY "plant_hourly_logs_insert"
  ON public.plant_hourly_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "plant_hourly_logs_update" ON public.plant_hourly_logs;
CREATE POLICY "plant_hourly_logs_update"
  ON public.plant_hourly_logs FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

-- 4. plant_delays (department_id present)
DROP POLICY IF EXISTS "plant_delays_select" ON public.plant_delays;
CREATE POLICY "plant_delays_select"
  ON public.plant_delays FOR SELECT
  TO authenticated
  USING (
    department_id IS NULL
    OR public.has_department_access(department_id)
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "plant_delays_insert" ON public.plant_delays;
CREATE POLICY "plant_delays_insert"
  ON public.plant_delays FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

DROP POLICY IF EXISTS "plant_delays_update" ON public.plant_delays;
CREATE POLICY "plant_delays_update"
  ON public.plant_delays FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (department_id IS NOT NULL AND public.has_department_access(department_id))
  );

-- 5. muster_events (no department_id; scoped to access-control/admin/supervisor)
DROP POLICY IF EXISTS "muster_events_select" ON public.muster_events;
CREATE POLICY "muster_events_select"
  ON public.muster_events FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role IN ('admin', 'access_control', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "muster_events_insert" ON public.muster_events;
CREATE POLICY "muster_events_insert"
  ON public.muster_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role IN ('admin', 'access_control', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "muster_events_update" ON public.muster_events;
CREATE POLICY "muster_events_update"
  ON public.muster_events FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role IN ('admin', 'access_control', 'supervisor')
    )
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_id = (SELECT auth.uid())
        AND e.role IN ('admin', 'access_control', 'supervisor')
    )
  );
