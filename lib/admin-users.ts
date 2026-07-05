export type AdminUserProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  plan: string;
  role: string;
  credits: number;
  tools_used_today: number;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  admin_notes: string | null;
  storage_used_mb: number;
  daily_tool_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserAuth = {
  email: string;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  banned_until: string | null;
  providers: string[];
};

export type AdminUserAction =
  | 'ban'
  | 'unban'
  | 'reset_quota'
  | 'notify'
  | 'password_reset';

export const PROFILE_SELECT =
  'id, full_name, avatar_url, email, plan, role, credits, tools_used_today, is_banned, banned_at, ban_reason, admin_notes, storage_used_mb, daily_tool_limit, stripe_customer_id, stripe_subscription_id, created_at, updated_at';

/** Progressively smaller selects so admin pages keep working on databases
 *  where the 06_user_admin.sql migration has not been run yet. */
export const PROFILE_SELECT_FALLBACKS = [
  PROFILE_SELECT,
  'id, full_name, avatar_url, plan, role, credits, tools_used_today, created_at, updated_at',
  'id, full_name, avatar_url, plan, role, tools_used_today, created_at',
] as const;

export function isMissingColumnError(message?: string | null): boolean {
  return !!message && /column .+ does not exist/i.test(message);
}

/** Fill defaults for columns that may not exist pre-migration. */
export function normalizeProfileRow(row: Record<string, unknown>): AdminUserProfile {
  return {
    id: String(row.id ?? ''),
    full_name: (row.full_name as string) ?? null,
    avatar_url: (row.avatar_url as string) ?? null,
    email: (row.email as string) ?? null,
    plan: (row.plan as string) ?? 'FREE',
    role: (row.role as string) ?? 'USER',
    credits: (row.credits as number) ?? 0,
    tools_used_today: (row.tools_used_today as number) ?? 0,
    is_banned: (row.is_banned as boolean) ?? false,
    banned_at: (row.banned_at as string) ?? null,
    ban_reason: (row.ban_reason as string) ?? null,
    admin_notes: (row.admin_notes as string) ?? null,
    storage_used_mb: (row.storage_used_mb as number) ?? 0,
    daily_tool_limit: (row.daily_tool_limit as number) ?? null,
    stripe_customer_id: (row.stripe_customer_id as string) ?? null,
    stripe_subscription_id: (row.stripe_subscription_id as string) ?? null,
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? ((row.created_at as string) ?? ''),
  };
}

/** Escape special chars for PostgREST ilike patterns */
export function escapeIlike(q: string): string {
  return q.replace(/[%_\\]/g, '\\$&');
}
