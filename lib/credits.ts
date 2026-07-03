import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ToolNest Credits — server-side helpers.
 * All balance changes go through the atomic `adjust_credits` Postgres function
 * (service role only) so double-spends and negative balances are impossible.
 */

export type CreditReason =
  | 'signup_bonus'
  | 'admin_grant'
  | 'admin_deduct'
  | 'ai_chat'
  | 'api_call'
  | 'purchase';

export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits');
    this.name = 'InsufficientCreditsError';
  }
}

/** Adjust a user's balance (positive = grant, negative = spend). Returns the new balance. */
export async function adjustCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  reason: CreditReason,
  actorId?: string,
  meta?: Record<string, unknown>,
): Promise<number> {
  const { data, error } = await admin.rpc('adjust_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_actor: actorId ?? null,
    p_meta: meta ?? {},
  });
  if (error) {
    if (error.message.includes('INSUFFICIENT_CREDITS')) throw new InsufficientCreditsError();
    throw new Error(error.message);
  }
  return data as number;
}

export async function getBalance(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin.from('profiles').select('credits').eq('id', userId).maybeSingle();
  return data?.credits ?? 0;
}

// ---------- API keys ----------

const KEY_BYTES = 24;

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Generate a new API key. The full key is returned once and never stored. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `tn_live_${randomBytes(KEY_BYTES).toString('hex')}`;
  return { key, hash: hashApiKey(key), prefix: `${key.slice(0, 15)}…` };
}

export interface ApiKeyAuth {
  keyId: string;
  userId: string;
}

/** Resolve a Bearer API key to its owner. Returns null when invalid or revoked. */
export async function authenticateApiKey(
  admin: SupabaseClient,
  req: Request,
): Promise<ApiKeyAuth | null> {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(tn_live_[a-f0-9]{48})$/i);
  if (!match) return null;

  const { data } = await admin
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hashApiKey(match[1]))
    .maybeSingle();

  if (!data || data.revoked_at) return null;

  // Best-effort last-used stamp.
  void admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
    .then(() => undefined);

  return { keyId: data.id, userId: data.user_id };
}
