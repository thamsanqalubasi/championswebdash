-- ==============================================================================
-- Paimbabook System Fix Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/elgocjdpvzpcrvvvjyaw/sql/new
-- ==============================================================================

-- 1. FIX: Row-Level Security (RLS) on marketing_boosted_listings
-- Allows authenticated staff and public clients to read, insert, update and delete boosts
ALTER TABLE public.marketing_boosted_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view boosted listings" ON public.marketing_boosted_listings;
CREATE POLICY "Public can view boosted listings" 
  ON public.marketing_boosted_listings 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow all access to boosted listings" ON public.marketing_boosted_listings;
CREATE POLICY "Allow all access to boosted listings" 
  ON public.marketing_boosted_listings 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access to boosted listings" ON public.marketing_boosted_listings;
CREATE POLICY "Authenticated users full access to boosted listings" 
  ON public.marketing_boosted_listings 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Also ensure geo-targeting and budget columns exist
ALTER TABLE public.marketing_boosted_listings
  ADD COLUMN IF NOT EXISTS target_geo jsonb NOT NULL DEFAULT '{"global": true, "countries": [], "cities": []}'::jsonb,
  ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boost_start_date date,
  ADD COLUMN IF NOT EXISTS boost_end_date date;

-- 2. ENHANCE: tenant_rent_payments for POP upload and dual-staff tracking
ALTER TABLE public.tenant_rent_payments
  ADD COLUMN IF NOT EXISTS pop_url text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_by_name text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'EFT / Bank Transfer';

-- 3. ENSURE: RLS on tenant_rent_payments allows full staff access
ALTER TABLE public.tenant_rent_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to manage rent payments" ON public.tenant_rent_payments;
CREATE POLICY "Allow staff to manage rent payments"
  ON public.tenant_rent_payments
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. ENSURE: RLS on tenant_payment_proofs allows full staff access
ALTER TABLE public.tenant_payment_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on payment proofs" ON public.tenant_payment_proofs;
CREATE POLICY "Allow all on payment proofs"
  ON public.tenant_payment_proofs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. ENSURE: Users table has signature and profile columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

SELECT 'Migration completed successfully! Boost RLS, POP columns and staff signatures are now active.' AS status;

