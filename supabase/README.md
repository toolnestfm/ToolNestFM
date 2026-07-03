# Supabase setup

## 1. Run full schema
In **Supabase Dashboard → SQL Editor**, run `schema.sql` (entire file).

## 2. Promote super admin (by email)
Run `02_promote_super_admin.sql` after the user exists in Auth.

## 3. Or bootstrap via script (recommended)
Never commit passwords. From project root:

```bash
# PowerShell
$env:ADMIN_EMAIL="your@email.com"
$env:ADMIN_PASSWORD="your-secure-password"
npm run admin:bootstrap
```

This creates the user (if missing), sets password, and assigns `SUPER_ADMIN` + `ENTERPRISE`.
