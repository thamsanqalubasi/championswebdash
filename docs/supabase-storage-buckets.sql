-- ==============================================================================
-- SUPABASE STORAGE BUCKETS SETUP & PERMISSIONS
-- Run this in Supabase Dashboard -> SQL Editor to initialize all media buckets
-- ==============================================================================

-- 1. Create buckets if they do not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('room-photos', 'room-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('property-photos', 'property-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('marketing-assets', 'marketing-assets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('room-type-photos', 'room-type-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('tenant-proofs', 'tenant-proofs', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('inspection-photos', 'inspection-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos', 'company-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Storage Policies for Public Reading
DROP POLICY IF EXISTS "Public Read Access for room-photos" ON storage.objects;
CREATE POLICY "Public Read Access for room-photos" ON storage.objects FOR SELECT USING (bucket_id = 'room-photos');

DROP POLICY IF EXISTS "Public Read Access for property-photos" ON storage.objects;
CREATE POLICY "Public Read Access for property-photos" ON storage.objects FOR SELECT USING (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "Public Read Access for marketing-assets" ON storage.objects;
CREATE POLICY "Public Read Access for marketing-assets" ON storage.objects FOR SELECT USING (bucket_id = 'marketing-assets');

DROP POLICY IF EXISTS "Public Read Access for room-type-photos" ON storage.objects;
CREATE POLICY "Public Read Access for room-type-photos" ON storage.objects FOR SELECT USING (bucket_id = 'room-type-photos');

-- 3. Storage Policies for Authenticated & Anonymous Uploading
DROP POLICY IF EXISTS "Allow All Uploads to room-photos" ON storage.objects;
CREATE POLICY "Allow All Uploads to room-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'room-photos');

DROP POLICY IF EXISTS "Allow All Updates to room-photos" ON storage.objects;
CREATE POLICY "Allow All Updates to room-photos" ON storage.objects FOR UPDATE USING (bucket_id = 'room-photos');

DROP POLICY IF EXISTS "Allow All Uploads to property-photos" ON storage.objects;
CREATE POLICY "Allow All Uploads to property-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "Allow All Uploads to marketing-assets" ON storage.objects;
CREATE POLICY "Allow All Uploads to marketing-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'marketing-assets');

DROP POLICY IF EXISTS "Allow All Uploads to room-type-photos" ON storage.objects;
CREATE POLICY "Allow All Uploads to room-type-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'room-type-photos');

