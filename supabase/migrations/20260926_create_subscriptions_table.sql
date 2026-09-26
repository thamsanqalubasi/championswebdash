-- Migration: Create Subscriptions and Payment Transactions Tables
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/elgocjdpvzpcrvvvjyaw/sql

-- 1. Create company_subscriptions table
create table if not exists public.company_subscriptions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    package_id text not null default 'starter', -- 'starter', 'standard', 'pro', 'enterprise', 'test'
    status text not null default 'trial', -- 'trial', 'active', 'expired', 'past_due', 'cancelled'
    amount_usd numeric(10, 2) not null default 5.00,
    billing_cycle text not null default 'monthly',
    is_trial boolean not null default true,
    trial_started_at timestamptz default now(),
    trial_duration_seconds integer not null default 60, -- 60s in test mode
    current_period_start timestamptz default now(),
    current_period_end timestamptz default (now() + interval '30 days'),
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_payment_intent_id text,
    package_mode_enabled boolean not null default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint unique_company_subscription unique (company_id)
);

-- 2. Create payment_transactions table for financial auditing
create table if not exists public.payment_transactions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    package_id text not null,
    amount_usd numeric(10, 2) not null,
    currency text not null default 'usd',
    status text not null default 'pending', -- 'pending', 'succeeded', 'failed', 'refunded'
    provider text not null default 'stripe',
    provider_tx_id text,
    receipt_url text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

-- 3. Indexes for fast lookup
create index if not exists idx_company_subscriptions_company_id on public.company_subscriptions(company_id);
create index if not exists idx_payment_transactions_company_id on public.payment_transactions(company_id);
create index if not exists idx_payment_transactions_provider_tx_id on public.payment_transactions(provider_tx_id);

-- 4. Enable Row Level Security (RLS)
alter table public.company_subscriptions enable row level security;
alter table public.payment_transactions enable row level security;

-- Policies for company_subscriptions
create policy "Company members can view their subscription"
    on public.company_subscriptions for select
    using (
        auth.uid() is not null
    );

create policy "Admins can update their company subscription"
    on public.company_subscriptions for all
    using (
        auth.uid() is not null
    );

-- Policies for payment_transactions
create policy "Company members can view their transactions"
    on public.payment_transactions for select
    using (
        auth.uid() is not null
    );
