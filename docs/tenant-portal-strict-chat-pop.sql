-- ==============================================================================
-- PAIMBABOOK STRICT TENANT PORTAL, DUAL CHAT & POP AUDIT TIMELINE SCHEMA
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. EXPAND TENANT PAYMENT PROOFS FOR DUAL-ORIGIN TRACKING (TENANT + STAFF)
ALTER TABLE IF EXISTS public.tenant_payment_proofs 
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS uploaded_by_type TEXT DEFAULT 'tenant' CHECK (uploaded_by_type IN ('tenant', 'staff', 'admin')),
  ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT,
  ADD COLUMN IF NOT EXISTS paid_month TEXT,
  ADD COLUMN IF NOT EXISTS paid_year TEXT;

-- 2. EXPAND TENANT RENT PAYMENTS FOR AUDIT TRAIL & POP LINKS
ALTER TABLE IF EXISTS public.tenant_rent_payments
  ADD COLUMN IF NOT EXISTS pop_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS recorded_by TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. EXPAND ENQUIRIES FOR DUAL-MODE CHATS (PROPERTY LEASE VS ROOM BOOKING)
ALTER TABLE IF EXISTS public.enquiries
  ADD COLUMN IF NOT EXISTS booking_id UUID,
  ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'assigned_property' CHECK (chat_type IN ('assigned_property', 'room_booking', 'listing_inquiry', 'general')),
  ADD COLUMN IF NOT EXISTS ticket_prompt_subject TEXT;

-- 4. ENSURE ENQUIRY MESSAGES SUPPORTS PROMPT ACTIONS & METADATA
ALTER TABLE IF EXISTS public.enquiry_messages
  ADD COLUMN IF NOT EXISTS is_ticket_prompt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompt_subject TEXT;

-- 5. COMMON TICKET INQUIRY SUBJECTS TABLE (CUSTOMIZABLE BY STAFF)
CREATE TABLE IF NOT EXISTS public.enquiry_ticket_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default ticket inquiry subjects
INSERT INTO public.enquiry_ticket_subjects (title, category, is_default)
VALUES 
  ('Maintenance: Plumbing Issue', 'maintenance', true),
  ('Maintenance: Electrical Fault', 'maintenance', true),
  ('Maintenance: Appliance Repair', 'maintenance', true),
  ('Lease & Contract Renewal', 'contract', true),
  ('Rent Payment & Proof of Payment Query', 'billing', true),
  ('Noise & Neighbor Disturbance', 'security', true),
  ('Key, Lock or Access Card Replacement', 'security', true),
  ('Housekeeping or Deep Cleaning Request', 'cleaning', true)
ON CONFLICT DO NOTHING;

-- 6. ENSURE STORAGE BUCKETS AND RLS PERMISSIONS
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('payment-proofs', 'payment-proofs', true),
  ('maintenance-photos', 'maintenance-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket policies
CREATE POLICY "Public Read payment-proofs" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'payment-proofs');

CREATE POLICY "Public Insert payment-proofs" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Public Read maintenance-photos" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'maintenance-photos');

CREATE POLICY "Public Insert maintenance-photos" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'maintenance-photos');

-- 7. ENABLE RLS & PERMISSIONS ON ENQUIRY_TICKET_SUBJECTS
ALTER TABLE public.enquiry_ticket_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enquiry_ticket_subjects_all" ON public.enquiry_ticket_subjects;
CREATE POLICY "enquiry_ticket_subjects_all" 
ON public.enquiry_ticket_subjects FOR ALL 
TO authenticated, anon 
USING (true) WITH CHECK (true);

GRANT ALL ON public.enquiry_ticket_subjects TO authenticated, anon;

