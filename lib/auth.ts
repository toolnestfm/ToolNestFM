export type UserPlan = 'free' | 'pro' | 'enterprise';
export type UserRole = 'user' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  plan: UserPlan;
  role: UserRole;
  storageUsedMb: number;
  storageLimitMb: number;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  role: string;
  tools_used_today: number;
}

export function planFromDb(plan: string): UserPlan {
  const p = plan.toLowerCase();
  if (p === 'pro') return 'pro';
  if (p === 'enterprise') return 'enterprise';
  return 'free';
}

export function storageLimitForPlan(plan: UserPlan): number {
  if (plan === 'pro') return 102400;
  if (plan === 'enterprise') return 512000;
  return 500;
}

export function roleFromDb(role: string): UserRole {
  const r = role.toUpperCase();
  if (r === 'SUPER_ADMIN') return 'super_admin';
  if (r === 'ADMIN') return 'admin';
  return 'user';
}

export function isAdminUser(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

export function profileToUser(
  profile: ProfileRow,
  email: string,
  storageUsedMb = 0,
): User {
  const plan = planFromDb(profile.plan);
  return {
    id: profile.id,
    email,
    fullName: profile.full_name || email.split('@')[0],
    avatarUrl: profile.avatar_url || undefined,
    plan,
    role: roleFromDb(profile.role),
    storageUsedMb,
    storageLimitMb: storageLimitForPlan(plan),
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
