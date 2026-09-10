-- Adds native recurrence support for property bill schedules.
-- Safe to run multiple times.

begin;

alter table public.property_bill_schedules
  add column if not exists frequency text;

update public.property_bill_schedules
set frequency = 'monthly'
where frequency is null or btrim(frequency) = '';

alter table public.property_bill_schedules
  alter column frequency set default 'monthly';

alter table public.property_bill_schedules
  alter column frequency set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'property_bill_schedules_frequency_check'
  ) then
    alter table public.property_bill_schedules
      add constraint property_bill_schedules_frequency_check
      check (frequency in ('monthly', 'quarterly', 'semi_annual', 'annual'));
  end if;
end $$;

commit;

-- Optional verification:
-- select frequency, count(*)
-- from public.property_bill_schedules
-- group by frequency
-- order by frequency;