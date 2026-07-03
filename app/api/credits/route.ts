import { apiErr, apiOk } from '@/lib/api-response';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getSupabaseEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

/** GET /api/credits — the signed-in user's balance + recent ledger. */
export async function GET() {
  if (!getSupabaseEnv()) return apiOk({ balance: 0, ledger: [] });

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErr('Sign in to view your credits', 401);

  const [{ data: profile }, { data: ledger, error }] = await Promise.all([
    supabase.from('profiles').select('credits').eq('id', user.id).maybeSingle(),
    supabase
      .from('credit_ledger')
      .select('id, amount, balance_after, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (error) {
    console.error('[credits] ledger fetch failed:', error.message);
    return apiErr('Could not load credits', 500);
  }

  return apiOk({ balance: profile?.credits ?? 0, ledger: ledger ?? [] });
}
