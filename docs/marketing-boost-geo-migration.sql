-- Migration: Add geo-targeting and budget columns to marketing_boosted_listings
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/elgocjdpvzpcrvvvjyaw/sql/new

ALTER TABLE public.marketing_boosted_listings
  ADD COLUMN IF NOT EXISTS target_geo jsonb NOT NULL DEFAULT '{"global": true, "countries": [], "cities": []}'::jsonb,
  ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boost_start_date date,
  ADD COLUMN IF NOT EXISTS boost_end_date date;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'marketing_boosted_listings'
  AND column_name IN ('target_geo', 'budget', 'boost_start_date', 'boost_end_date');

