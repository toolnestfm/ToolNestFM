import { apiErr } from '@/lib/api-response';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type ReportType = 'users' | 'jobs' | 'subscribers' | 'contact' | 'analytics';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const type = new URL(req.url).searchParams.get('type') as ReportType | null;
  if (!type) return apiErr('type query required: users|jobs|subscribers|contact|analytics', 400);

  let rows: Record<string, string | number | null>[] = [];
  const filename = `toolnest-${type}.csv`;

  if (type === 'users') {
    const { data } = await admin.from('profiles').select('id, full_name, plan, role, created_at').order('created_at', { ascending: false }).limit(5000);
    rows = (data ?? []).map((r) => ({ ...r }));
  } else if (type === 'jobs') {
    const { data } = await admin.from('jobs').select('id, user_id, tool_name, category, status, created_at').order('created_at', { ascending: false }).limit(10000);
    rows = (data ?? []).map((r) => ({ ...r }));
  } else if (type === 'subscribers') {
    const { data } = await admin.from('newsletter_subscribers').select('email, source, subscribed_at, unsubscribed_at').limit(10000);
    rows = (data ?? []).map((r) => ({ ...r }));
  } else if (type === 'contact') {
    const { data } = await admin.from('contact_messages').select('name, email, message, status, created_at').limit(5000);
    rows = (data ?? []).map((r) => ({ ...r }));
  } else if (type === 'analytics') {
    const { data } = await admin.from('analytics_events').select('event, user_id, created_at').order('created_at', { ascending: false }).limit(10000);
    rows = (data ?? []).map((r) => ({ ...r }));
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['empty'];
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
