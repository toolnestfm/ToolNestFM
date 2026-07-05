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

/** Escape special chars for PostgREST ilike patterns */
export function escapeIlike(q: string): string {
  return q.replace(/[%_\\]/g, '\\$&');
}
