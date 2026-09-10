-- Email delivery settings storage for Admin Settings
-- Run in Supabase SQL Editor

begin;

create table if not exists public.email_delivery_settings (
  id uuid primary key default gen_random_uuid(),
  method text not null default 'resend' check (method in ('mailto','resend','smtp','nodemailer','sendgrid','ses','mailgun')),
  from_name text default 'Champions Court',
  from_email text,
  reply_to text,

  resend_api_key text,

  smtp_host text,
  smtp_port integer default 587,
  smtp_secure boolean default false,
  smtp_user text,
  smtp_pass text,

  nodemailer_transport_json text,

  sendgrid_api_key text,

  ses_region text,
  ses_access_key_id text,
  ses_secret_access_key text,
  ses_from_arn text,

  mailgun_api_key text,
  mailgun_domain text,

  updated_by_email text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_email_delivery_settings_updated_at
  on public.email_delivery_settings(updated_at desc);

alter table public.email_delivery_settings enable row level security;

drop policy if exists "email_delivery_settings: auth select" on public.email_delivery_settings;
create policy "email_delivery_settings: auth select"
  on public.email_delivery_settings
  for select
  to authenticated
  using (true);

drop policy if exists "email_delivery_settings: auth insert" on public.email_delivery_settings;
create policy "email_delivery_settings: auth insert"
  on public.email_delivery_settings
  for insert
  to authenticated
  with check (true);

drop policy if exists "email_delivery_settings: auth update" on public.email_delivery_settings;
create policy "email_delivery_settings: auth update"
  on public.email_delivery_settings
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "email_delivery_settings: auth delete" on public.email_delivery_settings;
create policy "email_delivery_settings: auth delete"
  on public.email_delivery_settings
  for delete
  to authenticated
  using (true);

insert into public.email_delivery_settings (method, from_name)
select 'resend', 'Champions Court'
where not exists (select 1 from public.email_delivery_settings);

commit;
