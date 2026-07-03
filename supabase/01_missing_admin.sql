-- ============================================================
-- ToolNest — Missing admin tables (run on project xtmcsndjbgalovoqipmb)
-- Safe to re-run. Paste into Supabase → SQL Editor → Run.
-- ============================================================

-- Contact inbox columns
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS admin_note text;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON public.admin_audit_log (created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin settings key-value store
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Ensure super admin (already applied via bootstrap script)
UPDATE public.profiles
SET role = 'SUPER_ADMIN', plan = 'ENTERPRISE', full_name = COALESCE(full_name, 'Faruk Mondal'), updated_at = now()
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('farukmondal106@gmail.com') LIMIT 1);
