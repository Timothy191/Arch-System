-- Migration 083: Restrict Card Templates to Admin Only

-- Drop the existing policies for card_templates
DROP POLICY IF EXISTS "Allow access control insert card_templates" ON card_templates;
DROP POLICY IF EXISTS "Allow access control update card_templates" ON card_templates;

-- Recreate policies allowing ONLY 'admin' role to insert and update templates
CREATE POLICY "Allow admin insert card_templates" ON card_templates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Allow admin update card_templates" ON card_templates FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
);

-- Ensure the storage bucket for card templates exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('card-templates', 'card-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for card-templates bucket
CREATE POLICY "Allow public read card-templates" ON storage.objects FOR SELECT USING (
  bucket_id = 'card-templates'
);

CREATE POLICY "Allow admin insert card-templates" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'card-templates' AND
  EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND role = 'admin')
);
