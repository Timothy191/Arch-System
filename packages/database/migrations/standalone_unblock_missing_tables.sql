-- ==============================================================================
-- Standalone SQL Setup: delay_categories, delay_entries, & shift_status
-- Copy and execute this script directly inside the Supabase Cloud SQL Editor
-- ==============================================================================

-- 1. Create delay_categories table & seed defaults
CREATE TABLE IF NOT EXISTS delay_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO delay_categories (name, description) VALUES
  ('External', 'Delays caused by external factors beyond operational control'),
  ('Production', 'Delays related to production processes and operations'),
  ('Engineering', 'Delays caused by equipment breakdowns, maintenance, or engineering issues')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE delay_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delay_categories_select_all" ON delay_categories;
CREATE POLICY "delay_categories_select_all" ON delay_categories FOR SELECT TO authenticated USING (true);

-- 2. Create delay_entries table
CREATE TABLE IF NOT EXISTS delay_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_operation_id UUID NOT NULL REFERENCES machine_operations(id) ON DELETE CASCADE,
  delay_category_id UUID NOT NULL REFERENCES delay_categories(id) ON DELETE RESTRICT,
  delay_start_time TIMESTAMPTZ NOT NULL,
  delay_end_time TIMESTAMPTZ,
  duration_hours NUMERIC NOT NULL GENERATED ALWAYS AS (
    CASE 
      WHEN delay_end_time IS NOT NULL THEN EXTRACT(EPOCH FROM (delay_end_time - delay_start_time)) / 3600.0
      ELSE 0
    END
  ) STORED,
  is_manual_override BOOLEAN NOT NULL DEFAULT false,
  manual_duration_hours NUMERIC,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed')),
  committed_at TIMESTAMPTZ,
  committed_by UUID REFERENCES employees(id),
  uncommitted_at TIMESTAMPTZ,
  uncommitted_by UUID REFERENCES employees(id),
  uncommit_reason TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES employees(id),
  deleted_reason TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delay_entries_machine_operation_id ON delay_entries(machine_operation_id);
CREATE INDEX IF NOT EXISTS idx_delay_entries_delay_category_id ON delay_entries(delay_category_id);
CREATE INDEX IF NOT EXISTS idx_delay_entries_status ON delay_entries(status);

ALTER TABLE delay_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delay_entries_select_all" ON delay_entries;
CREATE POLICY "delay_entries_select_all" ON delay_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "delay_entries_all_authenticated" ON delay_entries;
CREATE POLICY "delay_entries_all_authenticated" ON delay_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Create shift_status table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code TEXT UNIQUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_hash TEXT;

CREATE TABLE IF NOT EXISTS shift_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'night')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES employees(id),
  approved_by UUID REFERENCES employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(department_id, shift_date, shift_type)
);

ALTER TABLE shift_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_status_select_all" ON shift_status;
CREATE POLICY "shift_status_select_all" ON shift_status FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shift_status_manage_all" ON shift_status;
CREATE POLICY "shift_status_manage_all" ON shift_status FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shift_status_dept_date_shift ON shift_status(department_id, shift_date DESC, shift_type);
