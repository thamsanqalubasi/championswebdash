-- Migration: Custom Booking Links, Discounts, and Marketing Opt-ins

-- 1. Add custom booking link and discount fields to properties
ALTER TABLE IF EXISTS public.properties 
ADD COLUMN IF NOT EXISTS booking_mode text DEFAULT 'platform',
ADD COLUMN IF NOT EXISTS external_booking_url text,
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_start_date date,
ADD COLUMN IF NOT EXISTS discount_end_date date;

-- 2. Add booking channel and discount fields to commercial rooms
ALTER TABLE IF EXISTS public.commercial_rooms
ADD COLUMN IF NOT EXISTS booking_mode text DEFAULT 'platform',
ADD COLUMN IF NOT EXISTS external_booking_url text,
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_start_date date,
ADD COLUMN IF NOT EXISTS discount_end_date date;

-- 3. Add discount fields to room_type_listings
ALTER TABLE IF EXISTS public.room_type_listings
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_start_date date,
ADD COLUMN IF NOT EXISTS discount_end_date date;

-- 4. Create marketing_agreed table to capture guest email opt-ins for discounts & marketing
CREATE TABLE IF NOT EXISTS public.marketing_agreed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  email text NOT NULL,
  agreed_discounts_and_marketing boolean DEFAULT true,
  source text DEFAULT 'portal_listing_external_booking',
  created_at timestamptz DEFAULT now()
);

-- 5. Enable RLS and add public insert policies for guest visitors
ALTER TABLE IF EXISTS public.marketing_agreed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous guest insert marketing_agreed" ON public.marketing_agreed;
CREATE POLICY "Allow anonymous guest insert marketing_agreed"
ON public.marketing_agreed FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read marketing_agreed" ON public.marketing_agreed;
CREATE POLICY "Allow authenticated read marketing_agreed"
ON public.marketing_agreed FOR SELECT TO authenticated
USING (true);

