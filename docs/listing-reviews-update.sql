-- 1. Ensure company_id is nullable or has default, and add room_type_listing_id
ALTER TABLE IF EXISTS public.listing_reviews 
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.listing_reviews 
  ADD COLUMN IF NOT EXISTS room_type_listing_id uuid REFERENCES public.room_type_listings(id);

-- 2. Default is_approved to true so customer reviews show immediately
ALTER TABLE IF EXISTS public.listing_reviews 
  ALTER COLUMN is_approved SET DEFAULT true;

-- 3. Fix RLS policies to allow anyone to insert and view reviews
ALTER TABLE IF EXISTS public.listing_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.listing_reviews;
DROP POLICY IF EXISTS "Public can view reviews" ON public.listing_reviews;
DROP POLICY IF EXISTS "Approved reviews are public" ON public.listing_reviews;
DROP POLICY IF EXISTS "Authenticated users manage reviews" ON public.listing_reviews;

CREATE POLICY "Anyone can insert reviews" ON public.listing_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view reviews" ON public.listing_reviews
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users manage reviews" ON public.listing_reviews
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
