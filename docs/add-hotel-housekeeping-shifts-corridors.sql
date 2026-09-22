-- ======================================================================================
-- HOTEL HOUSEKEEPING SHIFTS, CORRIDORS, AUDIT PHOTOS & ROOM SERVICE TRAY RETRIEVAL MIGRATION
-- ======================================================================================

-- 1. Create Housekeeping Shifts Table
CREATE TABLE IF NOT EXISTS public.housekeeping_shifts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  shift_name text NOT NULL,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time text NOT NULL DEFAULT '07:00',
  end_time text NOT NULL DEFAULT '15:30',
  supervisor_name text DEFAULT '',
  assigned_cleaners jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on housekeeping_shifts
ALTER TABLE public.housekeeping_shifts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "housekeeping_shifts_all_access" ON public.housekeeping_shifts
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_housekeeping_shifts_prop_date
  ON public.housekeeping_shifts (property_id, shift_date);

-- 2. Alter Housekeeping Schedules for Corridor / Floor Scope & Photos
-- Make room_id nullable so corridors, wings, and public floors can be scheduled without a specific room
ALTER TABLE public.housekeeping_schedules ALTER COLUMN room_id DROP NOT NULL;

-- Add Scope, Floor, Corridor, Shift Link, Duration Timer, Photos & Inspection fields
ALTER TABLE public.housekeeping_schedules
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS floor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS corridor_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.housekeeping_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_shift_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspected_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspected_by text DEFAULT '',
  ADD COLUMN IF NOT EXISTS before_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS after_photos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add index on scope and floor for rapid filtering
CREATE INDEX IF NOT EXISTS idx_housekeeping_schedules_scope_floor
  ON public.housekeeping_schedules (property_id, scope_type, floor);

-- 3. Alter Room Service Schedules for Runner & Post-Dining Corridor Tray Retrieval
ALTER TABLE public.room_service_schedules
  ADD COLUMN IF NOT EXISTS runner_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_delivery_time timestamptz,
  ADD COLUMN IF NOT EXISTS tray_retrieval_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS tray_retrieval_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_room_service_tray_retrieval
  ON public.room_service_schedules (property_id, tray_retrieval_status);

