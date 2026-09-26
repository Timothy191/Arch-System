-- Migration 079: Personnel Photos Storage Bucket
-- Creates a Supabase Storage bucket for personnel photos with RLS.

-- 1. Create the storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'personnel-photos',
  'personnel-photos',
  false,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: SELECT — access_control and admin roles can view
CREATE POLICY "personnel_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'personnel-photos'
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
        AND role IN ('access_control', 'admin')
    )
  );

-- 3. RLS: INSERT — access_control and admin roles can upload
CREATE POLICY "personnel_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'personnel-photos'
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
        AND role IN ('access_control', 'admin')
    )
  );

-- 4. RLS: UPDATE — only admin can modify
CREATE POLICY "personnel_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'personnel-photos'
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 5. RLS: DELETE — only admin can delete
CREATE POLICY "personnel_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'personnel-photos'
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE auth_id = auth.uid()
        AND role = 'admin'
    )
  );
