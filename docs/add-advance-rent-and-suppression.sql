-- ==============================================================================
-- Paimbabook: Rent Payments Suppression, Invoicing & Advance Payment Schema Fix
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/elgocjdpvzpcrvvvjyaw/sql/new
-- ==============================================================================

-- 1. Ensure tenant_rent_payments supports suppression and advance payments
ALTER TABLE IF EXISTS public.tenant_rent_payments
  ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppressed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suppressed_by text,
  ADD COLUMN IF NOT EXISTS suppressed_reason text,
  ADD COLUMN IF NOT EXISTS is_advance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS advance_months text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS paid_months text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS paid_month text,
  ADD COLUMN IF NOT EXISTS pop_url text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_by_name text,
  ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'EFT / Bank Transfer',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS executed_by_name text,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tenant_rent_payments_suppressed 
  ON public.tenant_rent_payments(is_suppressed, tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_rent_payments_paid_months 
  ON public.tenant_rent_payments USING GIN(paid_months);

-- 2. Ensure invoices table supports suppressed status
-- If status is an ENUM, allow 'suppressed', or ensure text status accepts 'suppressed'
ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false;

-- 3. Re-assert RLS policies
ALTER TABLE IF EXISTS public.tenant_rent_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_rent_payments_all" ON public.tenant_rent_payments;
CREATE POLICY "tenant_rent_payments_all" ON public.tenant_rent_payments
  FOR ALL TO public USING (true) WITH CHECK (true);

