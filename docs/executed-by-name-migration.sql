-- Add executor display-name columns used by Finance Accounts balance sheet.
-- Safe to run multiple times.

alter table if exists public.tenant_rent_payments
  add column if not exists executed_by_name text;

alter table if exists public.property_monthly_bills
  add column if not exists executed_by_name text;

alter table if exists public.maintenance
  add column if not exists executed_by_name text;
