-- Migration: Add POP URL and Confirmed By Name to property_monthly_bills
-- Run this in your Supabase SQL Editor if you want to store Proof of Payment directly on the monthly bills table.

ALTER TABLE public.property_monthly_bills 
  ADD COLUMN IF NOT EXISTS pop_url text,
  ADD COLUMN IF NOT EXISTS confirmed_by_name text;

COMMENT ON COLUMN public.property_monthly_bills.pop_url IS 'URL of uploaded proof of payment image or PDF document.';
COMMENT ON COLUMN public.property_monthly_bills.confirmed_by_name IS 'Name of the admin or staff who confirmed the bill payment.';

