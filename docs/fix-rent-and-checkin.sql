-- ==============================================================================
-- Paimbabook Rent Payments & Front Desk Check-in Fix
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/elgocjdpvzpcrvvvjyaw/sql/new
-- ==============================================================================

-- 1. Ensure tenant_rent_payments supports all recording fields & arrays
ALTER TABLE IF EXISTS public.tenant_rent_payments
  ADD COLUMN IF NOT EXISTS paid_months text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS paid_month text,
  ADD COLUMN IF NOT EXISTS pop_url text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_by_name text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'EFT / Bank Transfer',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS executed_by_name text,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- 2. Ensure tenant_payment_proofs has all required tracking columns
ALTER TABLE IF EXISTS public.tenant_payment_proofs
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'EFT / Bank Transfer',
  ADD COLUMN IF NOT EXISTS uploaded_by_type text DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS uploaded_by_name text,
  ADD COLUMN IF NOT EXISTS paid_month text,
  ADD COLUMN IF NOT EXISTS paid_year text,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- 3. Ensure commercial_bookings supports all check-in columns & aliases
ALTER TABLE IF EXISTS public.commercial_bookings
  ADD COLUMN IF NOT EXISTS booking_status text DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nights integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rate_per_night numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checked_in_by_name text,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS special_requests text,
  ADD COLUMN IF NOT EXISTS guest_id_number text DEFAULT 'N/A';

-- 4. Re-assert RLS policies on rent payments and commercial bookings
ALTER TABLE IF EXISTS public.tenant_rent_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_rent_payments_all" ON public.tenant_rent_payments;
CREATE POLICY "tenant_rent_payments_all" ON public.tenant_rent_payments
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.tenant_payment_proofs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_payment_proofs_all" ON public.tenant_payment_proofs;
CREATE POLICY "tenant_payment_proofs_all" ON public.tenant_payment_proofs
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.commercial_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial_bookings_all" ON public.commercial_bookings;
CREATE POLICY "commercial_bookings_all" ON public.commercial_bookings
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.commercial_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial_rooms_all" ON public.commercial_rooms;
CREATE POLICY "commercial_rooms_all" ON public.commercial_rooms
  FOR ALL TO public USING (true) WITH CHECK (true);

