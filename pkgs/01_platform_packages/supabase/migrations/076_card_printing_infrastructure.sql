-- Migration 076: Card Printing Infrastructure — Printers, Templates, Jobs & Issued Cards

-- 1. Card Printers — Registered/detected Neo Magic 300 printers
CREATE TABLE card_printers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    model text NOT NULL DEFAULT 'Neo Magic 300',
    cups_name text UNIQUE NOT NULL,
    connection_type text NOT NULL DEFAULT 'usb',
    vendor_id text,
    product_id text,
    device_path text,
    status text NOT NULL DEFAULT 'offline',
    status_message text,
    last_online_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

-- 2. Card Templates — Card layout designs
CREATE TABLE card_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    layout jsonb NOT NULL DEFAULT '{}',
    fields text[] NOT NULL DEFAULT '{}',
    background text DEFAULT '#ffffff',
    default_expiry_days integer DEFAULT 365,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

-- 3. Print Jobs — Print queue
CREATE TABLE print_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    printer_id uuid REFERENCES card_printers(id),
    template_id uuid REFERENCES card_templates(id),
    personnel_id uuid REFERENCES personnel(id),
    status text NOT NULL DEFAULT 'queued',
    cups_job_id integer,
    error_message text,
    employee_name text NOT NULL,
    department_name text,
    role_title text,
    qr_code_data text,
    rfid_uid text,
    queued_at timestamptz DEFAULT now(),
    rendering_started_at timestamptz,
    printing_started_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    expires_at timestamptz,
    created_by uuid REFERENCES employees(id),
    note text
);

-- 4. Issued Cards — Card registry
CREATE TABLE issued_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id uuid REFERENCES personnel(id),
    print_job_id uuid REFERENCES print_jobs(id) UNIQUE,
    qr_code_data text UNIQUE NOT NULL,
    rfid_uid text UNIQUE,
    issued_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    status text NOT NULL DEFAULT 'active',
    revoked_at timestamptz,
    revoked_reason text,
    lost_at timestamptz,
    replaced_by uuid REFERENCES issued_cards(id)
);

-- 5. Add photo_url column to personnel table
ALTER TABLE personnel ADD COLUMN photo_url text;

-- 6. Indexes for fast querying
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_jobs_printer_id ON print_jobs(printer_id);
CREATE INDEX idx_print_jobs_personnel_id ON print_jobs(personnel_id);
CREATE INDEX idx_print_jobs_queued_at ON print_jobs(queued_at DESC);
CREATE INDEX idx_issued_cards_personnel_id ON issued_cards(personnel_id);
CREATE INDEX idx_issued_cards_status ON issued_cards(status);
CREATE INDEX idx_issued_cards_expires_at ON issued_cards(expires_at);

-- 7. Enable Row Level Security
ALTER TABLE card_printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_cards ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies — role-based access (access_control and admin)

-- card_printers policies
CREATE POLICY "Allow access control read card_printers" ON card_printers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control insert card_printers" ON card_printers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control update card_printers" ON card_printers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow admin delete card_printers" ON card_printers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
);

-- card_templates policies
CREATE POLICY "Allow access control read card_templates" ON card_templates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control insert card_templates" ON card_templates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control update card_templates" ON card_templates FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow admin delete card_templates" ON card_templates FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
);

-- print_jobs policies
CREATE POLICY "Allow access control read print_jobs" ON print_jobs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control insert print_jobs" ON print_jobs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control update print_jobs" ON print_jobs FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow admin delete print_jobs" ON print_jobs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
);

-- issued_cards policies
CREATE POLICY "Allow access control read issued_cards" ON issued_cards FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control insert issued_cards" ON issued_cards FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow access control update issued_cards" ON issued_cards FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role IN ('access_control', 'admin'))
);
CREATE POLICY "Allow admin delete issued_cards" ON issued_cards FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
);
