-- ArchDB control-plane metadata and tenant primitives
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS archdb;

CREATE TABLE IF NOT EXISTS archdb.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS archdb.migrations (
  version bigint PRIMARY KEY,
  name text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL,
  execution_ms integer,
  UNIQUE(version, checksum)
);

CREATE TABLE IF NOT EXISTS archdb.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid REFERENCES archdb.projects(id) ON DELETE CASCADE,
  actor_id text,
  actor_role text,
  action text NOT NULL,
  object_type text NOT NULL,
  object_schema text,
  object_name text,
  object_id text,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_project_created_idx ON archdb.audit_events(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS archdb.api_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES archdb.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS archdb.rls_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES archdb.projects(id) ON DELETE CASCADE,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  policy_name text NOT NULL,
  command text NOT NULL CHECK (command IN ('SELECT','INSERT','UPDATE','DELETE','ALL')),
  using_expression text,
  check_expression text,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE(project_id, schema_name, table_name, policy_name)
);

CREATE OR REPLACE FUNCTION archdb.current_project_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('archdb.project_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION archdb.write_audit(
  p_action text, p_object_type text, p_object_schema text DEFAULT NULL,
  p_object_name text DEFAULT NULL, p_object_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO archdb.audit_events(project_id, actor_id, action, object_type, object_schema, object_name, object_id, details)
  VALUES (archdb.current_project_id(), current_setting('archdb.actor_id', true), p_action, p_object_type, p_object_schema, p_object_name, p_object_id, p_details)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

ALTER TABLE archdb.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_project_isolation ON archdb.audit_events;
CREATE POLICY audit_project_isolation ON archdb.audit_events
  USING (project_id = archdb.current_project_id());
