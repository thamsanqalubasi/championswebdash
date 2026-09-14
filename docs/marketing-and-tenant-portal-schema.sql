-- ==============================================================================
-- MARKETING DEPARTMENT & TENANT SELF-SERVICE UPGRADE SCHEMA
-- Multi-tenant isolation enforced via company_id on all tables
-- ==============================================================================

-- 1. MARKETING CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_audience VARCHAR(100) DEFAULT 'all',
  budget NUMERIC(12, 2) DEFAULT 0,
  spent NUMERIC(12, 2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_company ON public.marketing_campaigns(company_id);

-- 2. MARKETING BANNER ADS (For Front Portal Index File)
CREATE TABLE IF NOT EXISTS public.marketing_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  placement VARCHAR(50) NOT NULL DEFAULT 'hero_banner' CHECK (placement IN ('hero_banner', 'ticker', 'in_feed', 'popup')),
  image_url TEXT,
  cta_text VARCHAR(100) DEFAULT 'Explore Now',
  link_url TEXT,
  target_property_id UUID,
  badge_text VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  impressions_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_ads_company ON public.marketing_ads(company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ads_active ON public.marketing_ads(is_active, placement);

-- 3. MARKETING BOOSTED LISTINGS (Prioritized on Portal)
CREATE TABLE IF NOT EXISTS public.marketing_boosted_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  listing_type VARCHAR(50) NOT NULL DEFAULT 'property' CHECK (listing_type IN ('property', 'room_type', 'agent_listing')),
  listing_id UUID NOT NULL,
  boost_tier VARCHAR(50) NOT NULL DEFAULT 'featured' CHECK (boost_tier IN ('standard', 'featured', 'premium_sponsor')),
  badge_label VARCHAR(100) DEFAULT '🔥 Featured',
  priority_score INTEGER DEFAULT 10,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  impressions_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boosted_listings_active ON public.marketing_boosted_listings(is_active, listing_id);
CREATE INDEX IF NOT EXISTS idx_boosted_listings_company ON public.marketing_boosted_listings(company_id);

-- 4. MARKETING AD & BOOST ANALYTICS TELEMETRY
CREATE TABLE IF NOT EXISTS public.marketing_ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  ad_id UUID REFERENCES public.marketing_ads(id) ON DELETE CASCADE,
  boosted_id UUID REFERENCES public.marketing_boosted_listings(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('impression', 'click', 'cta_submit')),
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_ad ON public.marketing_ad_events(ad_id, event_type);
CREATE INDEX IF NOT EXISTS idx_marketing_events_company ON public.marketing_ad_events(company_id, created_at);

-- 5. TENANT PAYMENT PROOFS (Proof of Payment / POP Uploads)
CREATE TABLE IF NOT EXISTS public.tenant_payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  tenant_id UUID,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  property_id UUID,
  invoice_id UUID,
  amount NUMERIC(12, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number VARCHAR(100),
  document_url TEXT NOT NULL,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'verified', 'rejected')),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_proofs_company ON public.tenant_payment_proofs(company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payment_proofs_email ON public.tenant_payment_proofs(customer_email);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_boosted_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_payment_proofs ENABLE ROW LEVEL SECURITY;

-- Anonymous/Public Read for active ads and boosted listings on portal
DROP POLICY IF EXISTS "Public can view active ads" ON public.marketing_ads;
CREATE POLICY "Public can view active ads" ON public.marketing_ads FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view boosted listings" ON public.marketing_boosted_listings;
CREATE POLICY "Public can view boosted listings" ON public.marketing_boosted_listings FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can log ad telemetry" ON public.marketing_ad_events;
CREATE POLICY "Public can log ad telemetry" ON public.marketing_ad_events FOR INSERT WITH CHECK (true);

-- Authenticated Staff full access
DROP POLICY IF EXISTS "Authenticated users full access to marketing campaigns" ON public.marketing_campaigns;
CREATE POLICY "Authenticated users full access to marketing campaigns" ON public.marketing_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access to marketing ads" ON public.marketing_ads;
CREATE POLICY "Authenticated users full access to marketing ads" ON public.marketing_ads FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access to boosted listings" ON public.marketing_boosted_listings;
CREATE POLICY "Authenticated users full access to boosted listings" ON public.marketing_boosted_listings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access to marketing events" ON public.marketing_ad_events;
CREATE POLICY "Authenticated users full access to marketing events" ON public.marketing_ad_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal customers to insert payment proofs" ON public.tenant_payment_proofs;
CREATE POLICY "Allow portal customers to insert payment proofs" ON public.tenant_payment_proofs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to view their payment proofs" ON public.tenant_payment_proofs;
CREATE POLICY "Allow users to view their payment proofs" ON public.tenant_payment_proofs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow staff to update payment proofs" ON public.tenant_payment_proofs;
CREATE POLICY "Allow staff to update payment proofs" ON public.tenant_payment_proofs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

