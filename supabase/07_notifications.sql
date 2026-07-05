-- Notification broadcasts audit + Realtime for live bell updates

create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text,
  href text,
  target_type text not null default 'all',  -- all | plan | user
  target_value text,
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists notification_broadcasts_created_idx
  on public.notification_broadcasts (created_at desc);

alter table public.notification_broadcasts enable row level security;

-- Realtime: push new notifications to connected clients
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
