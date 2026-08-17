-- ArchDB sample tenant table demonstrating database-native RLS.
CREATE TABLE IF NOT EXISTS public.archdb_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES archdb.projects(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS archdb_records_project_idx ON public.archdb_records(project_id, id);
ALTER TABLE public.archdb_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS archdb_records_project_isolation ON public.archdb_records;
CREATE POLICY archdb_records_project_isolation ON public.archdb_records
  USING (project_id = archdb.current_project_id())
  WITH CHECK (project_id = archdb.current_project_id());

CREATE OR REPLACE FUNCTION public.archdb_records_touch() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS archdb_records_touch ON public.archdb_records;
CREATE TRIGGER archdb_records_touch BEFORE UPDATE ON public.archdb_records
FOR EACH ROW EXECUTE FUNCTION public.archdb_records_touch();
