#!/usr/bin/env node
/**
 * One-time bootstrap: create admin user via Supabase service role.
 * Usage (never commit passwords):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-password' node scripts/bootstrap-admin.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME || 'Faruk Mondal';
const role = process.env.ADMIN_ROLE || 'SUPER_ADMIN';

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

let userId = existing?.id;

if (!userId) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    console.error('Create user failed:', error?.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log('Created user:', email);
} else {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    console.error('Update password failed:', error.message);
    process.exit(1);
  }
  console.log('User already exists, password updated:', email);
}

const { error: profileErr } = await admin.from('profiles').upsert({
  id: userId,
  full_name: fullName,
  plan: 'ENTERPRISE',
  role,
  updated_at: new Date().toISOString(),
});

if (profileErr) {
  console.error('Profile upsert failed:', profileErr.message);
  process.exit(1);
}

console.log(`Done. ${email} is ${role} with ENTERPRISE plan.`);
console.log('Login at /login then open /admin/profile');
