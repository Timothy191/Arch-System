-- Harden the offline SMR mutation RPC without changing the already-deployed
-- schema objects or the original migration.
CREATE OR REPLACE FUNCTION public.apply_offline_mutations(
  p_tenant uuid,
  p_mutations jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m jsonb;
  v_mutation_id uuid;
  v_hlc_wall numeric;
  v_hlc_counter numeric;
  v_node_id text;
  v_entity text;
  v_entity_id text;
  v_payload jsonb;
  v_meter_id text;
  v_reading numeric;
  v_reading_at timestamptz;
  v_device_id text;
  v_employee_role text;
  v_department_id uuid;
  v_accessible_departments uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_tenant IS NULL
     OR p_mutations IS NULL
     OR pg_catalog.jsonb_typeof(p_mutations) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_mutations) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid offline mutation batch'
      USING ERRCODE = '22023';
  END IF;

  SELECT e.role, e.department_id, e.accessible_departments
    INTO v_employee_role, v_department_id, v_accessible_departments
    FROM public.employees AS e
   WHERE e.auth_id = auth.uid()
   FOR KEY SHARE;

  IF NOT FOUND OR v_employee_role = 'viewer' THEN
    RAISE EXCEPTION 'Employee is not authorized to write offline mutations'
      USING ERRCODE = '42501';
  END IF;

  IF v_employee_role <> 'admin'
     AND p_tenant IS DISTINCT FROM v_department_id
     AND NOT (p_tenant = ANY(COALESCE(v_accessible_departments, ARRAY[]::uuid[]))) THEN
    RAISE EXCEPTION 'Employee cannot write to the requested department'
      USING ERRCODE = '42501';
  END IF;

  FOR m IN
    SELECT item.value
      FROM pg_catalog.jsonb_array_elements(p_mutations) AS item(value)
  LOOP
    IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object'
       OR m->>'entity' IS DISTINCT FROM 'smr'
       OR m->>'op' IS DISTINCT FROM 'smr.update'
       OR pg_catalog.jsonb_typeof(m->'hlc') IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(m->'payload') IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(m #> '{hlc,wall}') IS DISTINCT FROM 'number'
       OR pg_catalog.jsonb_typeof(m #> '{hlc,counter}') IS DISTINCT FROM 'number'
       OR pg_catalog.jsonb_typeof(m #> '{payload,reading}') IS DISTINCT FROM 'number'
       OR NULLIF(m->>'id', '') IS NULL
       OR NULLIF(m #>> '{hlc,node}', '') IS NULL
       OR NULLIF(m->>'entityId', '') IS NULL
       OR NULLIF(m #>> '{payload,meterId}', '') IS NULL
       OR NULLIF(m #>> '{payload,readingAt}', '') IS NULL
       OR NULLIF(m #>> '{payload,deviceId}', '') IS NULL THEN
      RAISE EXCEPTION 'Invalid offline SMR mutation'
        USING ERRCODE = '22023';
    END IF;

    v_hlc_wall := (m #>> '{hlc,wall}')::numeric;
    v_hlc_counter := (m #>> '{hlc,counter}')::numeric;
    v_reading := (m #>> '{payload,reading}')::numeric;
    IF v_hlc_wall < 0
       OR v_hlc_wall <> pg_catalog.trunc(v_hlc_wall)
       OR v_hlc_wall > 9223372036854775807
       OR v_hlc_counter < 0
       OR v_hlc_counter <> pg_catalog.trunc(v_hlc_counter)
       OR v_hlc_counter > 2147483647
       OR v_reading < 0
       OR pg_catalog.length(m #>> '{hlc,node}') > 128
       OR pg_catalog.length(m->>'entityId') > 128
       OR pg_catalog.length(m #>> '{payload,meterId}') > 128
       OR pg_catalog.length(m #>> '{payload,deviceId}') > 128 THEN
      RAISE EXCEPTION 'Offline SMR mutation values are outside the supported range'
        USING ERRCODE = '22023';
    END IF;

    v_mutation_id := (m->>'id')::uuid;
    v_node_id := m #>> '{hlc,node}';
    v_entity := m->>'entity';
    v_entity_id := m->>'entityId';
    v_payload := m->'payload';
    v_meter_id := v_payload->>'meterId';
    v_reading_at := (v_payload->>'readingAt')::timestamptz;
    v_device_id := v_payload->>'deviceId';

    INSERT INTO public.mutation_log (
      tenant_id, mutation_id, hlc_wall, hlc_counter, node_id,
      entity, entity_id, op, payload
    ) VALUES (
      p_tenant, v_mutation_id, v_hlc_wall::bigint, v_hlc_counter::integer,
      v_node_id, v_entity, v_entity_id, 'smr.update', v_payload
    ) ON CONFLICT (tenant_id, mutation_id) DO NOTHING;

    INSERT INTO public.smr_readings (
      tenant_id, meter_id, reading, reading_at, device_id,
      hlc_wall, hlc_counter, node_id, mutation_id
    ) VALUES (
      p_tenant, v_meter_id, v_reading, v_reading_at, v_device_id,
      v_hlc_wall::bigint, v_hlc_counter::integer, v_node_id, v_mutation_id
    ) ON CONFLICT (tenant_id, mutation_id) DO NOTHING;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_offline_mutations(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_offline_mutations(uuid, jsonb) TO authenticated;
