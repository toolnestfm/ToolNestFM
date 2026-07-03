-- ============================================================
-- ToolNest — Supabase Schema (idempotent, safe to re-run)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  plan text not null default 'FREE',            -- 'FREE' | 'PRO' | 'ENTERPRISE'
  role text not null default 'USER',
  tools_used_today integer not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- JOBS (tool usage history) ----------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_slug text not null,
  tool_name text not null,
  category text not null,
  status text not null default 'completed',     -- used | completed | failed
  created_at timestamptz not null default now()
);

create index if not exists jobs_user_created_idx on public.jobs (user_id, created_at desc);

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_own" on public.jobs;
create policy "jobs_select_own" on public.jobs
  for select using (auth.uid() = user_id);

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own" on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "jobs_delete_own" on public.jobs;
create policy "jobs_delete_own" on public.jobs
  for delete using (auth.uid() = user_id);

-- ---------- NEWSLETTER ----------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table public.newsletter_subscribers enable row level security;
-- No public policies: only the service-role key (server) can read/write.

-- ---------- CONTACT MESSAGES ----------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages add column if not exists status text not null default 'new';
alter table public.contact_messages add column if not exists admin_note text;
alter table public.contact_messages add column if not exists updated_at timestamptz not null default now();

alter table public.contact_messages enable row level security;
-- Service-role only.

-- ---------- SEARCH LOGS ----------
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  results_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.search_logs enable row level security;
-- Service-role only.

-- ---------- ANALYTICS EVENTS ----------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  props jsonb not null default '{}'::jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists analytics_event_idx on public.analytics_events (event, created_at desc);

alter table public.analytics_events enable row level security;
-- Service-role only.

-- ---------- ADMIN AUDIT LOG ----------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
-- Service-role only.

-- ---------- ADMIN SETTINGS (key-value config store) ----------
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.admin_settings enable row level security;
-- Service-role only.

-- ============================================================
-- CREDITS SYSTEM — ToolNest API credits
-- ============================================================

-- Balance lives on the profile for fast reads; every change is ledgered.
alter table public.profiles add column if not exists credits integer not null default 0;

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,                        -- positive = grant, negative = spend
  balance_after integer not null,
  reason text not null,                           -- signup_bonus | admin_grant | admin_deduct | ai_chat | api_call | purchase
  actor_id uuid references auth.users(id) on delete set null,  -- admin who granted, null = system/self
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;

drop policy if exists "credit_ledger_select_own" on public.credit_ledger;
create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);
-- Inserts only via adjust_credits() / service role.

-- Atomic credit adjustment: prevents double-spend and negative balances.
create or replace function public.adjust_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_actor uuid default null,
  p_meta jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance integer;
begin
  update public.profiles
    set credits = credits + p_amount, updated_at = now()
    where id = p_user_id and credits + p_amount >= 0
    returning credits into new_balance;

  if new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_ledger (user_id, amount, balance_after, reason, actor_id, meta)
    values (p_user_id, p_amount, new_balance, p_reason, p_actor, p_meta);

  return new_balance;
end;
$$;

-- Only the service role (server) may adjust credits — never the browser.
revoke execute on function public.adjust_credits(uuid, integer, text, uuid, jsonb) from public, anon, authenticated;

-- ---------- API KEYS (ToolNest public API) ----------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text unique not null,                  -- sha256 of the full key; the key itself is never stored
  prefix text not null,                           -- display prefix e.g. tn_live_ab12…
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_user_idx on public.api_keys (user_id, created_at desc);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);
-- Writes via service role only (creation returns the key once).

-- ---------- SIGNUP BONUS ----------
-- New users start with 25 free credits (replaces the old handle_new_user).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, credits)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    25
  )
  on conflict (id) do nothing;

  insert into public.credit_ledger (user_id, amount, balance_after, reason)
  values (new.id, 25, 25, 'signup_bonus');

  return new;
end;
$$;
