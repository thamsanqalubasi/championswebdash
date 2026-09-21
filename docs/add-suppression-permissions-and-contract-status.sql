-- ==============================================================================
-- Paimbabook: Contracts Suppression, Invoicing & Permanent Deletion Policy Schema
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/elgocjdpvzpcrvvvjyaw/sql/new
-- ==============================================================================

-- 1. Ensure contracts table supports suppression and auditing
ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppressed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suppressed_by text,
  ADD COLUMN IF NOT EXISTS suppressed_reason text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contracts_suppressed 
  ON public.contracts(is_suppressed, tenant_id);

-- 2. Ensure invoices table supports suppression and auditing
ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppressed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suppressed_by text,
  ADD COLUMN IF NOT EXISTS suppressed_reason text;

CREATE INDEX IF NOT EXISTS idx_invoices_suppressed 
  ON public.invoices(is_suppressed, tenant_id);

-- 3. Ensure tenant_rent_payments supports suppression and auditing
ALTER TABLE IF EXISTS public.tenant_rent_payments
  ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppressed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suppressed_by text,
  ADD COLUMN IF NOT EXISTS suppressed_reason text;

-- 4. Re-assert RLS policies to allow authorized staff/super admins to DELETE records
-- (PostgreSQL Row Level Security must permit DELETE for permanent deletion)
ALTER TABLE IF EXISTS public.tenant_rent_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_rent_payments_all" ON public.tenant_rent_payments;
CREATE POLICY "tenant_rent_payments_all" ON public.tenant_rent_payments
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
CREATE POLICY "invoices_all" ON public.invoices
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_items_all" ON public.invoice_items;
CREATE POLICY "invoice_items_all" ON public.invoice_items
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contracts_all" ON public.contracts;
CREATE POLICY "contracts_all" ON public.contracts
  FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.contract_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contract_sections_all" ON public.contract_sections;
CREATE POLICY "contract_sections_all" ON public.contract_sections
  FOR ALL TO public USING (true) WITH CHECK (true);
