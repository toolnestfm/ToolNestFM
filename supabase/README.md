# Supabase setup

## Live project status (`xtmcsndjbgalovoqipmb`)

Already applied via API/bootstrap:

- Core tables: `profiles`, `jobs`, `newsletter_subscribers`, `contact_messages`, `search_logs`, `analytics_events`
- Super admin: `farukmondal106@gmail.com` → `SUPER_ADMIN` + `ENTERPRISE`

Optional (recommended) — run **`01_missing_admin.sql`** in SQL Editor for dedicated:

- `admin_audit_log`
- `admin_settings`
- `contact_messages.status` / `admin_note` / `updated_at`

Until that runs, the admin panel uses safe fallbacks (`analytics_events`).

## Full schema (new projects)

Run `schema.sql` (entire file) in **Supabase Dashboard → SQL Editor**.

## Promote super admin (by email)

Run `02_promote_super_admin.sql` after the user exists in Auth.

## Bootstrap script

Never commit passwords. From project root:

```bash
# PowerShell
$env:ADMIN_EMAIL="your@email.com"
$env:ADMIN_PASSWORD="your-secure-password"
npm run admin:bootstrap
```

This creates the user (if missing), sets password, and assigns `SUPER_ADMIN` + `ENTERPRISE`.
