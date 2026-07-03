import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppOrigin } from '@/lib/supabase/auth-url';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = getAppOrigin(requestUrl.origin);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  const authError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  if (authError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(authError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_auth_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message || 'auth_callback_failed')}`);
  }

  const user = data.user;
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'User';

  // Ensure profile row exists (ignore if table/trigger already handles it)
  await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: fullName,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      plan: 'FREE',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
