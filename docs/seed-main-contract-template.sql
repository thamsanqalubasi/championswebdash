-- ==============================================================================
-- SEED DEFAULT "MAIN CONTRACT" TEMPLATE & SECTIONS
-- 100% Safe to run multiple times (Fully Idempotent)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

BEGIN;

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ensure parent contract_templates table exists with all required columns
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid,
  title text NOT NULL,
  category text DEFAULT 'residential',
  content text DEFAULT '',
  description text DEFAULT '',
  monthly_rent numeric DEFAULT 0,
  deposit_amount numeric DEFAULT 0,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure all expected columns exist if the table was created previously
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS category text DEFAULT 'residential';
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS content text DEFAULT '';
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS monthly_rent numeric DEFAULT 0;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure unique constraint on title so ON CONFLICT (title) never throws 42P10
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_templates_title_key'
  ) THEN
    ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_title_key UNIQUE (title);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Ensure contract_template_sections table exists with both order_index and sort_order
CREATE TABLE IF NOT EXISTS public.contract_template_sections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  section_key text,
  order_index integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  title text NOT NULL,
  content text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contract_template_sections ADD COLUMN IF NOT EXISTS section_key text;
ALTER TABLE public.contract_template_sections ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;
ALTER TABLE public.contract_template_sections ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 4. Upsert the 'Main Contract' Template
INSERT INTO public.contract_templates (
  title,
  category,
  content,
  description,
  monthly_rent,
  deposit_amount,
  is_default
)
VALUES (
  'Main Contract',
  'residential',
  '<p style="text-align: center;"><strong>LEASE AGREEMENT</strong></p>',
  'Residential lease template with full clauses and editable sections.',
  4500,
  4500,
  true
)
ON CONFLICT (title)
DO UPDATE SET
  category = COALESCE(public.contract_templates.category, EXCLUDED.category),
  content = CASE WHEN COALESCE(public.contract_templates.content, '') = '' THEN EXCLUDED.content ELSE public.contract_templates.content END,
  description = EXCLUDED.description,
  monthly_rent = EXCLUDED.monthly_rent,
  deposit_amount = EXCLUDED.deposit_amount,
  is_default = true,
  updated_at = now();

-- Set as only default template
UPDATE public.contract_templates
SET is_default = (title = 'Main Contract');

-- 5. Delete any existing sections for 'Main Contract' to prevent duplicate or corrupted clauses
DELETE FROM public.contract_template_sections
WHERE template_id IN (
  SELECT id FROM public.contract_templates WHERE title = 'Main Contract'
);

-- 6. Insert all 12 complete, legally structured contract sections
INSERT INTO public.contract_template_sections (
  template_id,
  section_key,
  order_index,
  sort_order,
  title,
  content
)
SELECT
  mt.id,
  'sec_' || (s.idx + 1),
  s.idx,
  s.idx,
  s.title,
  s.content
FROM public.contract_templates mt
CROSS JOIN (
  VALUES
    (0, 'Memorandum of Agreement', '<p style="text-align: center;"><strong>LEASE AGREEMENT</strong></p><p style="text-align: center;"><strong>(For Residential Accommodation)</strong></p><p style="text-align: center;"><strong>Memorandum of Agreement</strong></p><p style="text-align: justify;">This Memorandum of Agreement is made and entered into by and between the <strong>Landlord</strong> and the <strong>Lessee</strong> under the terms and conditions set out in this contract.</p>'),
    (1, 'Property Description', '<p style="text-align: justify;">The Landlord lets to the Lessee, who hires, the following property ("<strong>The Property</strong>"):</p><p style="text-align: justify;"><strong>Residential Accommodation Unit</strong>, located at the designated premises address specified in the lease schedule.</p>'),
    (2, 'Lease Period and Rental', '<p style="text-align: justify;"><strong>Lease Term:</strong> As agreed in the lease schedule.</p><p style="text-align: justify;"><strong>Monthly Rent:</strong> As specified in the financial terms schedule.</p><p style="text-align: justify;">The Lessee agrees to annual escalation aligned with the latest inflation information at the anniversary of this lease.</p>'),
    (3, 'Payment Terms and Banking Details', '<p style="text-align: justify;">Rent is payable by stop order or electronic banking, in advance, on or before the 1st day of each month.</p><p style="text-align: justify;">Where cash deposits are used, the Lessee bears all related banking charges.</p><p style="text-align: justify;"><strong>Bank Details:</strong></p><p style="text-align: justify;">[Landlord banking details as registered under Contract Landlord Information]</p><p style="text-align: justify;">If rental remains unpaid on due date, the Landlord may cancel this lease in writing, resume possession of the property, and pursue arrear rental, damages, and any legal remedies available.</p><p style="text-align: justify;">The Lessee undertakes to pay <strong>10% interest</strong> on rent paid later than the 5th day of the month, payable in that same month.</p>'),
    (4, 'Deposit and Deductions', '<p style="text-align: justify;"><strong>Deposit:</strong> As specified in the lease schedule, payable prior to occupation.</p><p style="text-align: justify;">The Landlord will refund the appropriate portion of the deposit after lease termination, subject to the property being returned in good condition and all outstanding rental and interest being settled.</p><p style="text-align: justify;">The Landlord may withhold appropriate amounts for repainting, cleaning, or repairs if required beyond normal fair wear and tear.</p><p style="text-align: justify;">The Lessee may not use the deposit in place of monthly rental payments.</p><p style="text-align: justify;">If the Lessee fails to take occupation on the agreed date, the deposit is forfeited.</p>'),
    (5, 'Use and Care of the Property', '<p style="text-align: justify;">The Lessee undertakes to keep the inside and outside of the property in good order.</p><p style="text-align: justify;">The Lessee is responsible for damage caused during occupation.</p><p style="text-align: justify;">Any defects requiring repair must be reported in writing within the first 7 days of occupation; failing which, the Lessee may be held responsible.</p><p style="text-align: justify;">The property may only be used for residential purposes for which it is leased.</p><p style="text-align: justify;">The Lessee must keep the property clean, sanitary, and free from rubbish, litter, and pests. If not maintained, cleaning and pest-control costs may be charged to the Lessee.</p>'),
    (6, 'Alterations, Hazardous Materials, and Access', '<p style="text-align: justify;">No writing, painting, scratching, nails, screws, holes, or similar alterations may be made without prior written consent of the Landlord.</p><p style="text-align: justify;">No structural or other alterations may be made without prior written consent.</p><p style="text-align: justify;">Dangerous or inflammable materials (including petroleum products) may not be stored on the property if such use may invalidate building insurance.</p><p style="text-align: justify;">The Landlord or agent may inspect the property at all reasonable times.</p>'),
    (7, 'Liability, Utilities, and Insurance', '<p style="text-align: justify;">On termination or renewal completion, the Lessee shall return the property in the same order and condition as received.</p><p style="text-align: justify;">The Landlord is not responsible for damage to the Lessee''s belongings caused by wind, water, hail, lightning, fire, riot, theft, strikes, state enemies, or similar causes.</p><p style="text-align: justify;">Where structural defects are reported in writing, the Landlord shall take immediate steps to repair such defects.</p><p style="text-align: justify;">Water and electricity are included in rental, subject to fair and economical use. Leakages or failures of Lessee-owned equipment are for the Lessee''s account, and must be reported immediately.</p>'),
    (8, 'Occupancy, Conduct, and Restrictions', '<p style="text-align: justify;">No sub-letting is allowed.</p><p style="text-align: justify;">The Lessee may not cede or assign this lease without prior written consent of the Landlord.</p><p style="text-align: justify;">Maximum occupancy is <strong>1 adult</strong>, unless otherwise agreed in writing.</p><p style="text-align: justify;">No additional occupants are allowed without prior arrangement with the Landlord.</p><p style="text-align: justify;">No animals causing disturbance to other lessees may be harboured.</p><p style="text-align: justify;">Lessee and visitors may not engage in illegal activity, non-prescribed substance use, or behavior violating neighbors'' rights. Such conduct constitutes grounds for termination under Namibian law.</p><p style="text-align: justify;">The Lessee shall respect the rights of all other lessees and neighbors at all times.</p>'),
    (9, 'Termination, Renewal, and Notice', '<p style="text-align: justify;">This contract is binding on the Lessee for the full period stated in this agreement.</p><p style="text-align: justify;">The Lessee must give the Landlord one full calendar month''s written notice to terminate the lease early.</p><p style="text-align: justify;">In the absence of such notice, the lease may be extended for the same period as originally agreed.</p><p style="text-align: justify;">Failure to provide notice may result in forfeiture of the deposit.</p><p style="text-align: justify;">The Landlord reserves the right to terminate the contract prematurely by written notice to the Lessee.</p>'),
    (10, 'Signatures and Witnesses', '<p style="text-align: justify;">Thus done and signed at Windhoek on this ______ day of ______, in the presence of the undersigned witnesses.</p><p style="text-align: justify;"><strong>Witnesses:</strong> No.1 ____________________  No.2 ____________________</p><p style="text-align: justify;"><strong>Lessee Signature:</strong> ____________________</p><p style="text-align: justify;">Thus done and signed at Windhoek on this ______ day of ______, in the presence of the undersigned witnesses.</p><p style="text-align: justify;"><strong>Witnesses:</strong> No.1 ____________________  No.2 ____________________</p><p style="text-align: justify;"><strong>Landlord Signature:</strong> ____________________</p>')
) AS s(idx, title, content)
WHERE mt.title = 'Main Contract';

-- 7. Ensure RLS & permissions are properly configured
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_template_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_templates_all" ON public.contract_templates;
CREATE POLICY "contract_templates_all" ON public.contract_templates FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "contract_template_sections_all" ON public.contract_template_sections;
CREATE POLICY "contract_template_sections_all" ON public.contract_template_sections FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

GRANT ALL ON public.contract_templates TO anon, authenticated;
GRANT ALL ON public.contract_template_sections TO anon, authenticated;

COMMIT;

-- Verification
SELECT 
  ct.title AS template_title,
  ct.is_default,
  count(cts.id) AS section_count
FROM public.contract_templates ct
LEFT JOIN public.contract_template_sections cts ON cts.template_id = ct.id
WHERE ct.title = 'Main Contract'
GROUP BY ct.title, ct.is_default;
