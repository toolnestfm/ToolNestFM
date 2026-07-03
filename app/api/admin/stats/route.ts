import { apiOk } from '@/lib/api-response';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const [
    usersRes,
    jobsRes,
    subsRes,
    contactNewRes,
    eventsRes,
    searchRes,
    jobsTodayRes,
    proRes,
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('jobs').select('id', { count: 'exact', head: true }),
    admin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).is('unsubscribed_at', null),
    admin.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    admin.from('analytics_events').select('id', { count: 'exact', head: true }),
    admin.from('search_logs').select('id', { count: 'exact', head: true }),
    admin.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday()),
    admin.from('profiles').select('id', { count: 'exact', head: true }).in('plan', ['PRO', 'ENTERPRISE']),
  ]);

  let contactRes = contactNewRes;
  if (contactNewRes.error) {
    contactRes = await admin.from('contact_messages').select('id', { count: 'exact', head: true });
  }

  const { data: recentJobs } = await admin
    .from('jobs')
    .select('id, tool_name, category, status, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(8);

  const { data: topEvents } = await admin
    .from('analytics_events')
    .select('event')
    .gte('created_at', daysAgo(7));

  const eventCounts: Record<string, number> = {};
  (topEvents ?? []).forEach((e) => {
    eventCounts[e.event] = (eventCounts[e.event] ?? 0) + 1;
  });
  const topAnalytics = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([event, count]) => ({ event, count }));

  const { data: dailyJobs } = await admin
    .from('jobs')
    .select('created_at')
    .gte('created_at', daysAgo(7));

  const jobsByDay = bucketByDay(dailyJobs ?? [], 'created_at');

  return apiOk({
    totals: {
      users: usersRes.count ?? 0,
      jobs: jobsRes.count ?? 0,
      subscribers: subsRes.count ?? 0,
      newContact: contactRes.count ?? 0,
      analyticsEvents: eventsRes.count ?? 0,
      searches: searchRes.count ?? 0,
      jobsToday: jobsTodayRes.count ?? 0,
      proUsers: proRes.count ?? 0,
    },
    recentJobs: recentJobs ?? [],
    topAnalytics,
    jobsByDay,
  });
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function bucketByDay(rows: { created_at: string }[], key: 'created_at'): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  rows.forEach((r) => {
    const day = r[key].slice(0, 10);
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
  });
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}
