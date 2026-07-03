-- ============================================================
-- ToolNest — Promote super admin by email (safe to re-run)
-- Run AFTER schema.sql and after the user has signed up OR
-- after scripts/bootstrap-admin.mjs created the account.
-- ============================================================

UPDATE public.profiles
SET
  role = 'SUPER_ADMIN',
  plan = 'ENTERPRISE',
  full_name = COALESCE(full_name, 'Faruk Mondal'),
  updated_at = now()
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = lower('farukmondal106@gmail.com')
  LIMIT 1
);

-- Verify (optional — check result in Supabase SQL editor)
SELECT p.id, u.email, p.full_name, p.role, p.plan
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) = lower('farukmondal106@gmail.com');
