import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';
import { adjustCredits, InsufficientCreditsError } from '@/lib/credits';

export const dynamic = 'force-dynamic';

/** GET /api/admin/credits?userId=&page= — credit ledger (all users or one). */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') || '';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 25;
  const from = (page - 1) * limit;

  let query = admin
    .from('credit_ledger')
    .select('id, user_id, amount, balance_after, reason, actor_id, meta, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (userId) query = query.eq('user_id', userId);

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  return apiOk({ ledger: data ?? [], total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}

/** POST /api/admin/credits — grant (+) or deduct (−) credits for a user. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId: actorId } = auth.ctx;

  let body: { userId?: string; amount?: number; note?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  const targetId = body.userId?.trim();
  const amount = Number(body.amount);
  if (!targetId) return apiErr('userId is required', 400);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) {
    return apiErr('amount must be a non-zero integer (max ±1,000,000)', 400);
  }

  try {
    const balance = await adjustCredits(
      admin,
      targetId,
      amount,
      amount > 0 ? 'admin_grant' : 'admin_deduct',
      actorId,
      body.note ? { note: body.note.slice(0, 200) } : undefined,
    );
    await logAdminAction(admin, actorId, amount > 0 ? 'credits.grant' : 'credits.deduct', targetId, {
      amount,
      balance,
      note: body.note ?? null,
    });
    return apiOk({ balance });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return apiErr('Deduction would make the balance negative', 400);
    }
    return apiErr(err instanceof Error ? err.message : 'Credit adjustment failed', 500);
  }
}
