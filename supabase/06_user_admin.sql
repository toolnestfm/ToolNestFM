-- User admin fields: email sync, ban status, admin notes, quota override
-- Run in Supabase SQL Editor after schema.sql / 01_missing_admin.sql

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists admin_notes text;
alter table public.profiles add column if not exists storage_used_mb integer not null default 0;
alter table public.profiles add column if not exists daily_tool_limit integer;

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_banned_idx on public.profiles (is_banned) where is_banned = true;

-- Sync email on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email, credits)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    25
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  if not exists (
    select 1 from public.credit_ledger where user_id = new.id and reason = 'signup_bonus'
  ) then
    insert into public.credit_ledger (user_id, amount, balance_after, reason)
    values (new.id, 25, 25, 'signup_bonus');
  end if;

  return new;
end;
$$;

-- Backfill emails from auth.users (run once)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- Allow service role to insert notifications for any user (admin broadcast)
drop policy if exists "notifications_insert_service" on public.notifications;
-- Notifications remain user-scoped for clients; admin uses service role.
