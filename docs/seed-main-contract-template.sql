-- Seed default "Main Contract" template and sections
-- Safe to run multiple times.

begin;

insert into public.contract_templates (
  title,
  category,
  content,
  description,
  monthly_rent,
  deposit_amount,
  is_default
)
values (
  'Main Contract',
  'residential',
  '<p style="text-align: center;"><strong>LEASE AGREEMENT</strong></p>',
  'Residential lease template with full clauses and editable sections.',
  4500,
  4500,
  true
)
on conflict (title)
do update set
  category = coalesce(public.contract_templates.category, excluded.category),
  content = case when coalesce(public.contract_templates.content, '') = '' then excluded.content else public.contract_templates.content end,
  description = excluded.description,
  monthly_rent = excluded.monthly_rent,
  deposit_amount = excluded.deposit_amount;

update public.contract_templates
set is_default = case when title = 'Main Contract' then true else false end;

with main_template as (
  select id
  from public.contract_templates
  where title = 'Main Contract'
  limit 1
), seed_sections(sort_order, title, content) as (
  values
    (0, 'Memorandum of Agreement', '<p style="text-align: center;"><strong>LEASE AGREEMENT</strong></p><p style="text-align: center;"><strong>(For Residential Accommodation)</strong></p><p style="text-align: center;"><strong>Memorandum of Agreement</strong></p><p style="text-align: justify;">This Memorandum of Agreement is made and entered into by and between the <strong>Landlord</strong> and the <strong>Lessee</strong> under the terms and conditions set out in this contract.</p>'),
    (1, 'Parties and Contact Details', '<p style="text-align: justify;"><strong>Landlord:</strong> Michael Beukes, ID 74020700079</p><p style="text-align: justify;"><strong>Landlord Address:</strong> 2673 J. James Street, Khomasdal, Windhoek</p><p style="text-align: justify;"><strong>Landlord Contact:</strong> 081 424 1935, michaelfbeukes@gmail.com</p><p style="text-align: justify;"><strong>Lessee:</strong> Mr Tamsanqa Lubasi, Passport EN903112</p><p style="text-align: justify;"><strong>Lessee Contact:</strong> thamulubasi@gmail.com, 081 844 5625</p><p style="text-align: justify;"><strong>Next of Kin:</strong> Nolwazi Dube, 081 811 5624</p><p style="text-align: justify;"><strong>Declaration:</strong> The Lessee confirms that all personal information supplied is correct.</p>'),
    (2, 'Property Description', '<p style="text-align: justify;">The Landlord lets to the Lessee, who hires, the following property ("<strong>The Property</strong>"):</p><p style="text-align: justify;"><strong>One bedroom flat (excluding garage)</strong>, located at <strong>2673 J. James Street, Khomasdal, Windhoek, Namibia</strong>.</p>'),
    (3, 'Lease Period and Rental', '<p style="text-align: justify;"><strong>Lease Term:</strong> 6 months</p><p style="text-align: justify;"><strong>Start Date:</strong> 1 May 2025</p><p style="text-align: justify;"><strong>End Date:</strong> 31 October 2025</p><p style="text-align: justify;"><strong>Pro-rata Rent:</strong> payable 11-30 April 2025 (4500/30 x 19 days = N$2850.00), due 10 April 2025.</p><p style="text-align: justify;"><strong>Monthly Rent:</strong> N$4500 (Four Thousand Five Hundred Namibian Dollars).</p><p style="text-align: justify;">The Lessee agrees to annual escalation aligned with the latest inflation information at the anniversary of this lease (reference: Bank of Namibia).</p>'),
    (4, 'Payment Terms and Banking Details', '<p style="text-align: justify;">Rent is payable by stop order or electronic banking, in advance, on or before the 1st day of each month.</p><p style="text-align: justify;">Where cash deposits are used, the Lessee bears all related banking charges.</p><p style="text-align: justify;"><strong>Bank Details:</strong></p><p style="text-align: justify;">Account Name: Michael Beukes<br/>Account No: 043132049<br/>Bank: Standard Bank Namibia<br/>Branch: Gustav Voigts Centre<br/>Branch Code: 087373</p><p style="text-align: justify;">If rental remains unpaid on due date, the Landlord may cancel this lease in writing, resume possession of the property, and pursue arrear rental, damages, and any legal remedies available.</p><p style="text-align: justify;">The Lessee undertakes to pay <strong>10% interest</strong> on rent paid later than the 5th day of the month, payable in that same month.</p>'),
    (5, 'Deposit and Deductions', '<p style="text-align: justify;"><strong>Deposit:</strong> N$4500 (Four Thousand Five Hundred Namibian Dollars), payable on or before 11 April 2025.</p><p style="text-align: justify;">The Landlord will refund the appropriate portion of the deposit after lease termination, subject to the property being returned in good condition and all outstanding rental and interest being settled.</p><p style="text-align: justify;">The Landlord may withhold <strong>N$700.00</strong> for repainting if required and <strong>N$300.00</strong> for pest control/cleaning if required.</p><p style="text-align: justify;">The Lessee may not use the deposit in place of monthly rental payments.</p><p style="text-align: justify;">If the Lessee fails to take occupation on the agreed date, the deposit is forfeited.</p>'),
    (6, 'Use and Care of the Property', '<p style="text-align: justify;">The Lessee undertakes to keep the inside and outside of the property in good order.</p><p style="text-align: justify;">The Lessee is responsible for damage caused during occupation.</p><p style="text-align: justify;">Any defects requiring repair must be reported in writing within the first 7 days of occupation; failing which, the Lessee may be held responsible.</p><p style="text-align: justify;">The property may only be used for residential purposes for which it is leased.</p><p style="text-align: justify;">The Lessee must keep the property clean, sanitary, and free from rubbish, litter, and pests. If not maintained, cleaning and pest-control costs may be charged to the Lessee.</p>'),
    (7, 'Alterations, Hazardous Materials, and Access', '<p style="text-align: justify;">No writing, painting, scratching, nails, screws, holes, or similar alterations may be made without prior written consent of the Landlord.</p><p style="text-align: justify;">No structural or other alterations may be made without prior written consent.</p><p style="text-align: justify;">Dangerous or inflammable materials (including petroleum products) may not be stored on the property if such use may invalidate building insurance.</p><p style="text-align: justify;">The Landlord or agent may inspect the property at all reasonable times.</p>'),
    (8, 'Liability, Utilities, and Insurance', '<p style="text-align: justify;">On termination or renewal completion, the Lessee shall return the property in the same order and condition as received.</p><p style="text-align: justify;">The Landlord is not responsible for damage to the Lessee''s belongings caused by wind, water, hail, lightning, fire, riot, theft, strikes, state enemies, or similar causes.</p><p style="text-align: justify;">Where structural defects are reported in writing, the Landlord shall take immediate steps to repair such defects.</p><p style="text-align: justify;">Water and electricity are included in rental, subject to fair and economical use. Leakages or failures of Lessee-owned equipment are for the Lessee''s account, and must be reported immediately.</p>'),
    (9, 'Occupancy, Conduct, and Restrictions', '<p style="text-align: justify;">No sub-letting is allowed.</p><p style="text-align: justify;">The Lessee may not cede or assign this lease without prior written consent of the Landlord.</p><p style="text-align: justify;">Maximum occupancy is <strong>1 adult</strong>, unless otherwise agreed in writing.</p><p style="text-align: justify;">No additional occupants are allowed without prior arrangement with the Landlord.</p><p style="text-align: justify;">No animals causing disturbance to other lessees may be harboured.</p><p style="text-align: justify;">Lessee and visitors may not engage in illegal activity, non-prescribed substance use, or behavior violating neighbors'' rights. Such conduct constitutes grounds for termination under Namibian law.</p><p style="text-align: justify;">The Lessee shall respect the rights of all other lessees and neighbors at all times.</p>'),
    (10, 'Termination, Renewal, and Notice', '<p style="text-align: justify;">This contract is binding on the Lessee for the full period stated in this agreement.</p><p style="text-align: justify;">The Lessee must give the Landlord one full calendar month''s written notice to terminate the lease early.</p><p style="text-align: justify;">In the absence of such notice, the lease may be extended for the same period as originally agreed.</p><p style="text-align: justify;">Failure to provide notice may result in forfeiture of the deposit.</p><p style="text-align: justify;">The Landlord reserves the right to terminate the contract prematurely by written notice to the Lessee.</p>'),
    (11, 'Signatures and Witnesses', '<p style="text-align: justify;">Thus done and signed at Windhoek on this ______ day of ______, in the presence of the undersigned witnesses.</p><p style="text-align: justify;"><strong>Witnesses:</strong> No.1 ____________________  No.2 ____________________</p><p style="text-align: justify;"><strong>Lessee Signature:</strong> ____________________</p><p style="text-align: justify;">Thus done and signed at Windhoek on this ______ day of ______, in the presence of the undersigned witnesses.</p><p style="text-align: justify;"><strong>Witnesses:</strong> No.1 ____________________  No.2 ____________________</p><p style="text-align: justify;"><strong>Landlord Signature:</strong> ____________________</p>')
)
insert into public.contract_template_sections (template_id, sort_order, title, content)
select mt.id, s.sort_order, s.title, s.content
from main_template mt
cross join seed_sections s
where not exists (
  select 1
  from public.contract_template_sections cts
  where cts.template_id = mt.id
);

commit;
