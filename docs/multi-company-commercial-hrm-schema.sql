-- ======================================================================================
-- CHAMPIONS COURT DASHBOARD - MULTI-COMPANY & COMMERCIAL LODGING & HRM SCHEMA MIGRATION
-- Execute this SQL in your Supabase SQL Editor.
-- ======================================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------------------------
-- 1. COMPANIES / ORGANIZATIONS TABLE (WordPress Multisite-style Architecture)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT 'Champions Court Group',
  slug text UNIQUE,
  logo_url text,
  logo_bucket_path text,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  tax_rate numeric NOT NULL DEFAULT 15.00,
  currency text NOT NULL DEFAULT 'ZAR',
  default_due_day integer NOT NULL DEFAULT 1,
  payment_instructions text DEFAULT '',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert Default Primary Company if none exists
INSERT INTO public.companies (id, name, slug, address, phone, email, tax_rate, currency)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Champions Court Hospitality & Properties',
  'champions-court',
  '124 Main Boulevard, Johannesburg, South Africa',
  '+27 11 987 6543',
  'admin@championscourt.co.za',
  15.00,
  'ZAR'
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------------------
-- 2. COMPANY USERS & DEPARTMENTAL RBAC TABLE
-- --------------------------------------------------------------------------------------
-- Departments: admin, manager, accountant, front_desk, it, maintenance, human_resources, procurement, audit
-- Role levels: super_admin, admin, manager, all_rights, staff
CREATE TABLE IF NOT EXISTS public.company_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department text NOT NULL DEFAULT 'admin' CHECK (department = ANY (ARRAY[
    'admin', 'manager', 'accountant', 'front_desk', 'it', 'maintenance', 'human_resources', 'procurement', 'audit'
  ])),
  job_title text NOT NULL DEFAULT 'Admin - Super Admin',
  role_level text NOT NULL DEFAULT 'admin' CHECK (role_level = ANY (ARRAY[
    'super_admin', 'admin', 'manager', 'all_rights', 'staff'
  ])),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_users_unique_company_user UNIQUE (company_id, user_id)
);

-- --------------------------------------------------------------------------------------
-- 3. ALTER EXISTING TABLES TO SCOPE BY company_id & EXPAND PROPERTY TYPES
-- --------------------------------------------------------------------------------------
DO $$
BEGIN
  -- Add company_id to properties
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'company_id') THEN
    ALTER TABLE public.properties ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  -- Add commercial lodging specific columns to properties
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'total_rooms') THEN
    ALTER TABLE public.properties ADD COLUMN total_rooms integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'uniform_room_pricing') THEN
    ALTER TABLE public.properties ADD COLUMN uniform_room_pricing boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'default_room_price') THEN
    ALTER TABLE public.properties ADD COLUMN default_room_price numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'default_bed_breakfast') THEN
    ALTER TABLE public.properties ADD COLUMN default_bed_breakfast numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'default_bed_lunch') THEN
    ALTER TABLE public.properties ADD COLUMN default_bed_lunch numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'default_full_board') THEN
    ALTER TABLE public.properties ADD COLUMN default_full_board numeric NOT NULL DEFAULT 0;
  END IF;

  -- Drop and expand type check constraint on properties
  ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_type_check;
  ALTER TABLE public.properties ADD CONSTRAINT properties_type_check CHECK (
    type = ANY (ARRAY[
      'house'::text, 'storage'::text, 'apartment'::text,
      'hotel'::text, 'motel'::text, 'lodge'::text, 'guest_house'::text, 'commercial'::text
    ])
  );

  -- Add company_id to other existing tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'company_id') THEN
    ALTER TABLE public.tenants ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'company_id') THEN
    ALTER TABLE public.invoices ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintainers' AND column_name = 'company_id') THEN
    ALTER TABLE public.maintainers ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance' AND column_name = 'company_id') THEN
    ALTER TABLE public.maintenance ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'company_id') THEN
    ALTER TABLE public.contracts ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspections' AND column_name = 'company_id') THEN
    ALTER TABLE public.inspections ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preventive_maintenance' AND column_name = 'company_id') THEN
    ALTER TABLE public.preventive_maintenance ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_inventory' AND column_name = 'company_id') THEN
    ALTER TABLE public.maintenance_inventory ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'renovations' AND column_name = 'company_id') THEN
    ALTER TABLE public.renovations ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'company_id') THEN
    ALTER TABLE public.audit_log ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_expenses' AND column_name = 'company_id') THEN
    ALTER TABLE public.property_expenses ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_bill_schedules' AND column_name = 'company_id') THEN
    ALTER TABLE public.property_bill_schedules ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_monthly_bills' AND column_name = 'company_id') THEN
    ALTER TABLE public.property_monthly_bills ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_templates' AND column_name = 'company_id') THEN
    ALTER TABLE public.contract_templates ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 'a0000000-0000-0000-0000-000000000001';
  END IF;
END $$;

-- --------------------------------------------------------------------------------------
-- 4. COMMERCIAL ROOMS TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  room_type text NOT NULL DEFAULT 'standard' CHECK (room_type = ANY (ARRAY[
    'standard', 'single', 'double', 'twin', 'suite', 'deluxe', 'family', 'penthouse', 'executive'
  ])),
  floor text DEFAULT 'Ground Floor',
  status text NOT NULL DEFAULT 'available' CHECK (status = ANY (ARRAY[
    'available', 'occupied', 'cleaning_needed', 'maintenance', 'reserved'
  ])),
  capacity_adults integer NOT NULL DEFAULT 2,
  capacity_children integer NOT NULL DEFAULT 0,
  amenities text[] NOT NULL DEFAULT '{"wifi", "tv", "ac", "ensuite_bathroom"}'::text[],
  photos text[] NOT NULL DEFAULT '{}'::text[],
  price_per_night numeric NOT NULL DEFAULT 0,
  price_bed_breakfast numeric NOT NULL DEFAULT 0,
  price_bed_lunch numeric NOT NULL DEFAULT 0,
  price_full_board numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_rooms_unique_number_per_property UNIQUE (property_id, room_number)
);

-- --------------------------------------------------------------------------------------
-- 5. COMMERCIAL BOOKINGS & CHECK-IN TABLE
-- --------------------------------------------------------------------------------------
-- Every check-in logs a booking_code for audit purposes
CREATE TABLE IF NOT EXISTS public.commercial_bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.commercial_rooms(id) ON DELETE CASCADE,
  booking_code text NOT NULL UNIQUE,
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  guest_email text DEFAULT '',
  guest_id_number text NOT NULL,
  check_in_date timestamptz NOT NULL,
  check_out_date timestamptz NOT NULL,
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  meal_plan text NOT NULL DEFAULT 'room_only' CHECK (meal_plan = ANY (ARRAY[
    'room_only', 'bed_breakfast', 'bed_lunch', 'full_board'
  ])),
  nights integer NOT NULL DEFAULT 1,
  rate_per_night numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  deposit_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'card' CHECK (payment_method = ANY (ARRAY['cash', 'card', 'eft', 'online', 'company_account'])),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status = ANY (ARRAY[
    'pending', 'partial', 'paid', 'refunded'
  ])),
  booking_status text NOT NULL DEFAULT 'confirmed' CHECK (booking_status = ANY (ARRAY[
    'confirmed', 'checked_in', 'checked_out', 'cancelled', 'extended'
  ])),
  is_extended boolean NOT NULL DEFAULT false,
  extension_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  checked_in_by_name text,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------------------
-- 6. HOUSEKEEPING & CLEANING SCHEDULES TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.housekeeping_schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.commercial_rooms(id) ON DELETE CASCADE,
  cleaner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cleaner_name text NOT NULL DEFAULT 'Housekeeping Team',
  cleaning_type text NOT NULL DEFAULT 'daily_tidy' CHECK (cleaning_type = ANY (ARRAY[
    'daily_tidy', 'turnover_clean', 'deep_clean', 'inspection', 'sanitization'
  ])),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY[
    'pending', 'in_progress', 'completed', 'verified'
  ])),
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  shift text NOT NULL DEFAULT 'morning' CHECK (shift = ANY (ARRAY['morning', 'afternoon', 'evening', 'turnover'])),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority = ANY (ARRAY['low', 'normal', 'high', 'urgent'])),
  completed_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------------------
-- 7. ROOM SERVICE SCHEDULES TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_service_schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.commercial_rooms(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.commercial_bookings(id) ON DELETE SET NULL,
  guest_name text NOT NULL DEFAULT 'In-house Guest',
  service_type text NOT NULL DEFAULT 'breakfast_delivery' CHECK (service_type = ANY (ARRAY[
    'breakfast_delivery', 'lunch_delivery', 'dinner_delivery', 'beverages', 'laundry', 'luggage', 'custom'
  ])),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status = ANY (ARRAY[
    'requested', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'
  ])),
  cost numeric NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------------------
-- 8. HUMAN RESOURCES: SALARY SCALES TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_salary_scales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department text NOT NULL,
  job_title text NOT NULL,
  grade_level text DEFAULT 'Band A',
  min_salary numeric NOT NULL DEFAULT 0,
  mid_salary numeric NOT NULL DEFAULT 0,
  max_salary numeric NOT NULL DEFAULT 0,
  housing_allowance numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  medical_allowance numeric NOT NULL DEFAULT 0,
  tax_deduction_pct numeric NOT NULL DEFAULT 15.00,
  pension_deduction_pct numeric NOT NULL DEFAULT 5.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_salary_scales_unique_dept_title UNIQUE (company_id, department, job_title)
);

-- --------------------------------------------------------------------------------------
-- 9. HUMAN RESOURCES: PAYSLIPS TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_payslips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  job_title text NOT NULL,
  department text NOT NULL,
  pay_period text NOT NULL, -- Format: YYYY-MM
  basic_salary numeric NOT NULL DEFAULT 0,
  allowances jsonb NOT NULL DEFAULT '{"housing": 0, "transport": 0, "medical": 0, "overtime": 0}'::jsonb,
  gross_pay numeric NOT NULL DEFAULT 0,
  deductions jsonb NOT NULL DEFAULT '{"paye_tax": 0, "pension": 0, "uif": 0}'::jsonb,
  net_pay numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft', 'approved', 'paid'])),
  payment_method text DEFAULT 'bank_transfer',
  paid_at timestamptz,
  pdf_url text,
  generated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hr_payslips_unique_user_period UNIQUE (company_id, user_id, pay_period)
);

-- --------------------------------------------------------------------------------------
-- 10. HUMAN RESOURCES: EMPLOYEE CONTRACT TEMPLATES TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_employee_contract_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  department text NOT NULL,
  template_body text NOT NULL,
  standard_leave_days integer NOT NULL DEFAULT 21,
  probation_months integer NOT NULL DEFAULT 3,
  working_hours_per_week integer NOT NULL DEFAULT 40,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------------------
-- 11. HUMAN RESOURCES: EMPLOYEE CONTRACTS TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_employee_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.hr_employee_contract_templates(id) ON DELETE SET NULL,
  employee_name text NOT NULL,
  department text NOT NULL,
  job_title text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_permanent boolean NOT NULL DEFAULT true,
  monthly_salary numeric NOT NULL DEFAULT 0,
  leave_days_per_year integer NOT NULL DEFAULT 21,
  contract_document_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['draft', 'active', 'suspended', 'terminated', 'expired'])),
  signed_at timestamptz,
  signed_by_employee boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------------------
-- 12. HUMAN RESOURCES: LEAVE RECORDS TABLE
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_leave_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  department text NOT NULL,
  leave_type text NOT NULL CHECK (leave_type = ANY (ARRAY[
    'annual', 'sick', 'study', 'maternity', 'paternity', 'bereavement', 'unpaid'
  ])),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL DEFAULT 1,
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'approved', 'rejected'])),
  approved_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by_name text,
  reviewed_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------------------
-- 13. PERFORMANCE INDEXES
-- --------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_properties_company_id ON public.properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties(type);
CREATE INDEX IF NOT EXISTS idx_commercial_rooms_property_id ON public.commercial_rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_commercial_rooms_company_id ON public.commercial_rooms(company_id);
CREATE INDEX IF NOT EXISTS idx_commercial_rooms_status ON public.commercial_rooms(status);
CREATE INDEX IF NOT EXISTS idx_commercial_bookings_company_id ON public.commercial_bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_commercial_bookings_booking_code ON public.commercial_bookings(booking_code);
CREATE INDEX IF NOT EXISTS idx_commercial_bookings_status ON public.commercial_bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_commercial_bookings_room_id ON public.commercial_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company_user ON public.company_users(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_dept ON public.company_users(department);
CREATE INDEX IF NOT EXISTS idx_housekeeping_property_date ON public.housekeeping_schedules(property_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_room_service_scheduled_time ON public.room_service_schedules(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_hr_payslips_period ON public.hr_payslips(company_id, pay_period);
CREATE INDEX IF NOT EXISTS idx_hr_leave_records_user ON public.hr_leave_records(user_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);

-- --------------------------------------------------------------------------------------
-- 14. DEFAULT SEED DATA & TEMPLATES
-- --------------------------------------------------------------------------------------

-- Insert Standard HR Contract Template
INSERT INTO public.hr_employee_contract_templates (
  company_id, title, department, template_body, standard_leave_days, probation_months, working_hours_per_week, is_default
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Standard Employment Agreement',
  'general',
  'EMPLOYMENT CONTRACT\n\nBetween {{company_name}} and {{employee_name}}.\n\n1. POSITION & DUTIES: The Employee is hired as {{job_title}} in the {{department}} Department.\n2. REMUNERATION: The gross monthly remuneration will be {{salary}}.\n3. WORKING HOURS: Normal working hours are {{working_hours}} hours per week.\n4. LEAVE: The Employee is entitled to {{leave_days}} paid annual leave days per annum.\n5. PROBATION: Subject to a probationary period of {{probation_period}} months.\n6. COMMENCEMENT: This agreement takes effect from {{start_date}}.',
  21,
  3,
  40,
  true
)
ON CONFLICT DO NOTHING;

-- Insert Standard HR Salary Scales
INSERT INTO public.hr_salary_scales (company_id, department, job_title, grade_level, min_salary, mid_salary, max_salary, housing_allowance, transport_allowance, medical_allowance, tax_deduction_pct, pension_deduction_pct)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'front_desk', 'Front Desk - Receptionist', 'Band B1', 12000, 15000, 18000, 1500, 1000, 800, 15.0, 5.0),
  ('a0000000-0000-0000-0000-000000000001', 'front_desk', 'Front Desk - Customer Service', 'Band B2', 13500, 16500, 19500, 1500, 1000, 800, 15.0, 5.0),
  ('a0000000-0000-0000-0000-000000000001', 'front_desk', 'Front Desk - Admin', 'Band M1', 22000, 26000, 30000, 2500, 1500, 1200, 18.0, 6.0),
  ('a0000000-0000-0000-0000-000000000001', 'maintenance', 'Maintenance - Cleaner', 'Band A1', 8500, 10500, 12500, 1000, 800, 600, 12.0, 5.0),
  ('a0000000-0000-0000-0000-000000000001', 'maintenance', 'Maintenance - Plumbing', 'Band B2', 16000, 20000, 24000, 1800, 1200, 900, 15.0, 5.0),
  ('a0000000-0000-0000-0000-000000000001', 'maintenance', 'Maintenance - Repairs', 'Band B2', 16000, 20000, 24000, 1800, 1200, 900, 15.0, 5.0),
  ('a0000000-0000-0000-0000-000000000001', 'maintenance', 'Maintenance - Manager', 'Band M1', 28000, 34000, 40000, 3000, 2000, 1500, 20.0, 7.5),
  ('a0000000-0000-0000-0000-000000000001', 'accountant', 'Accountant - Book Keeping', 'Band B3', 18000, 22000, 26000, 2000, 1200, 1000, 15.0, 5.0),
  ('a0000000-0000-0000-0000-000000000001', 'accountant', 'Accountant - Manager', 'Band M2', 35000, 42000, 50000, 4000, 2500, 2000, 25.0, 8.0),
  ('a0000000-0000-0000-0000-000000000001', 'it', 'IT - System Admin', 'Band B3', 25000, 30000, 35000, 2500, 1500, 1200, 18.0, 6.0),
  ('a0000000-0000-0000-0000-000000000001', 'human_resources', 'HR - Manager', 'Band M1', 30000, 36000, 42000, 3500, 2000, 1500, 22.0, 7.0),
  ('a0000000-0000-0000-0000-000000000001', 'audit', 'Audit - Auditor', 'Band B3', 24000, 29000, 34000, 2500, 1500, 1200, 18.0, 6.0)
ON CONFLICT (company_id, department, job_title) DO NOTHING;

-- Seed a sample Commercial Hotel Property if none exist
INSERT INTO public.properties (
  id, company_id, name, type, monthly_rent, status, address, total_rooms, uniform_room_pricing,
  default_room_price, default_bed_breakfast, default_bed_lunch, default_full_board, photos
) VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Grand Champions Safari Lodge & Hotel',
  'lodge',
  0,
  'occupied',
  'Plot 45 Kruger Gateway, Nelspruit, Mpumalanga',
  12,
  true,
  1250,
  1550,
  1850,
  2250,
  ARRAY['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80']
)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Rooms for the Lodge
INSERT INTO public.commercial_rooms (
  company_id, property_id, room_number, room_type, floor, status, capacity_adults, capacity_children,
  price_per_night, price_bed_breakfast, price_bed_lunch, price_full_board, amenities, photos
) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Room 101', 'deluxe', 'Ground Floor', 'occupied', 2, 1, 1250, 1550, 1850, 2250, ARRAY['wifi', 'tv', 'ac', 'balcony', 'minibar'], ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80']),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Room 102', 'suite', 'Ground Floor', 'available', 2, 2, 1600, 1900, 2200, 2600, ARRAY['wifi', 'tv', 'ac', 'jacuzzi', 'balcony'], ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80']),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Room 103', 'standard', 'Ground Floor', 'cleaning_needed', 2, 0, 950, 1200, 1450, 1750, ARRAY['wifi', 'tv', 'ac'], ARRAY['https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80']),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Room 201', 'executive', '1st Floor', 'reserved', 2, 0, 1800, 2100, 2400, 2800, ARRAY['wifi', 'tv', 'ac', 'work_desk', 'view'], ARRAY['https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80']),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Room 202', 'family', '1st Floor', 'available', 4, 2, 2200, 2600, 3000, 3500, ARRAY['wifi', 'tv', 'ac', 'kitchenette', 'balcony'], ARRAY['https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80'])
ON CONFLICT DO NOTHING;
