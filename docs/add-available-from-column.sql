-- Migration: Add available_from date to properties table
-- Enables prompt and display of scheduled vacancy dates on occupied listings.

ALTER TABLE IF EXISTS public.properties 
ADD COLUMN IF NOT EXISTS available_from date;

COMMENT ON COLUMN public.properties.available_from IS 'The date and month when an occupied property will become vacant and available for occupancy.';

