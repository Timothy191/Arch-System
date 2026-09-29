-- Migration 165: Offline CRDT Mutation Log and SMR Append-Only Store
-- Supports Hybrid Logical Clock (HLC) arbitration for intermittent field terminal connections

-- 1. mutation_log dedupes by tenant + mutation_id
CREATE TABLE IF NOT EXISTS mutation_log (
  tenant_id uuid NOT NULL,
  mutation_id uuid NOT NULL,
  hlc_wall bigint NOT NULL,
  hlc_counter int NOT NULL,
  node_id text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  op text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, mutation_id)
);

-- 2. SMR is append-only
CREATE TABLE IF NOT EXISTS smr_readings (
  tenant_id uuid NOT NULL,
  meter_id text NOT NULL,
  reading numeric NOT NULL,
  reading_at timestamptz NOT NULL,
  device_id text NOT NULL,
  hlc_wall bigint NOT NULL,
  hlc_counter int NOT NULL,
  node_id text NOT NULL,
  mutation_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, mutation_id)
);

CREATE INDEX IF NOT EXISTS smr_readings_latest_idx
  ON smr_readings (
    tenant_id, meter_id,
    reading_at DESC,
    hlc_wall DESC,
    hlc_counter DESC,
    node_id DESC
  );

-- 3. Row Level Security enforcement
ALTER TABLE mutation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE smr_readings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mutation_log' AND policyname = 'mutation_log_tenant_isolation'
  ) THEN
    CREATE POLICY mutation_log_tenant_isolation ON mutation_log
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'smr_readings' AND policyname = 'smr_readings_tenant_isolation'
  ) THEN
    CREATE POLICY smr_readings_tenant_isolation ON smr_readings
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

-- 4. Transactional RPC for atomic offline mutation replay
CREATE OR REPLACE FUNCTION apply_offline_mutations(
  p_tenant uuid,
  p_mutations jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  m jsonb;
  v_mutation_id uuid;
  v_hlc_wall bigint;
  v_hlc_counter int;
  v_node_id text;
  v_entity text;
  v_entity_id text;
  v_op text;
  v_payload jsonb;
BEGIN
  FOR m IN SELECT * FROM jsonb_array_elements(p_mutations)
  LOOP
    v_mutation_id := (m->>'id')::uuid;
    v_hlc_wall := (m->'hlc'->>'wall')::bigint;
    v_hlc_counter := (m->'hlc'->>'counter')::int;
    v_node_id := m->'hlc'->>'node';
    v_entity := m->>'entity';
    v_entity_id := m->>'entityId';
    v_op := m->>'op';
    v_payload := m->'payload';

    INSERT INTO mutation_log (
      tenant_id, mutation_id, hlc_wall, hlc_counter, node_id,
      entity, entity_id, op, payload
    ) VALUES (
      p_tenant, v_mutation_id, v_hlc_wall, v_hlc_counter, v_node_id,
      v_entity, v_entity_id, v_op, v_payload
    ) ON CONFLICT (tenant_id, mutation_id) DO NOTHING;

    IF v_op = 'smr.update' THEN
      INSERT INTO smr_readings (
        tenant_id, meter_id, reading, reading_at, device_id,
        hlc_wall, hlc_counter, node_id, mutation_id
      ) VALUES (
        p_tenant,
        v_payload->>'meterId',
        (v_payload->>'reading')::numeric,
        (v_payload->>'readingAt')::timestamptz,
        v_payload->>'deviceId',
        v_hlc_wall, v_hlc_counter, v_node_id, v_mutation_id
      ) ON CONFLICT (tenant_id, mutation_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END $$;

-- 5. Latest SMR materialized view with concurrent refresh index
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'smr_latest'
  ) THEN
    CREATE MATERIALIZED VIEW smr_latest AS
    SELECT DISTINCT ON (tenant_id, meter_id)
      tenant_id, meter_id, reading, reading_at, device_id,
      hlc_wall, hlc_counter, node_id
    FROM smr_readings
    ORDER BY tenant_id, meter_id,
             reading_at DESC,
             hlc_wall DESC,
             hlc_counter DESC,
             node_id DESC;

    CREATE UNIQUE INDEX smr_latest_tenant_meter_idx
      ON smr_latest (tenant_id, meter_id);
  END IF;
END $$;
