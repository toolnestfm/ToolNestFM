import { apiOk } from '@/lib/api-response';
import { requireApiKey } from '@/lib/api-v1';
import { getBalance } from '@/lib/credits';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/usage — recent API credit activity + balance. Free (API key required).
 */
export async function GET(req: Request) {
  const gate = await requireApiKey(req, 60);
  if (!gate.ok) return gate.response;
  const { admin, auth } = gate.ctx;

  const [balance, { data: ledger }] = await Promise.all([
    getBalance(admin, auth.userId),
    admin
      .from('credit_ledger')
      .select('amount, balance_after, reason, meta, created_at')
      .eq('user_id', auth.userId)
      .eq('reason', 'api_call')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return apiOk({ credits: balance, calls: ledger ?? [] });
}
