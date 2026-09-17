-- ==============================================================================
-- Paimbabook Finance Transactions & Accounting Pipeline Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/elgocjdpvzpcrvvvjyaw/sql/new
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'payment')),
  category text NOT NULL,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'EFT / Bank Transfer',
  reference_number text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending_approval', 'rejected')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent', 'critical')),
  attachments jsonb DEFAULT '[]'::jsonb, -- Array of { name, url, type, size, uploaded_at, uploaded_by }
  recorded_by_user_id text,
  recorded_by_name text,
  recorded_by_role text,
  approval_requested_to text,
  approval_requested_to_name text,
  approved_by_user_id text,
  approved_by_name text,
  approved_at timestamp with time zone,
  rejection_reason text,
  signature_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view finance transactions" ON public.finance_transactions;
CREATE POLICY "Public can view finance transactions" 
  ON public.finance_transactions 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow all access to finance transactions" ON public.finance_transactions;
CREATE POLICY "Allow all access to finance transactions" 
  ON public.finance_transactions 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access to finance transactions" ON public.finance_transactions;
CREATE POLICY "Authenticated users full access to finance transactions" 
  ON public.finance_transactions 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_finance_tx_company ON public.finance_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_date ON public.finance_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_finance_tx_status ON public.finance_transactions(status);
CREATE INDEX IF NOT EXISTS idx_finance_tx_property ON public.finance_transactions(property_id);

