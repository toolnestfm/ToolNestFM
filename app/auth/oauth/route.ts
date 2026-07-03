import { type NextRequest, NextResponse } from 'next/server';
import { getAppOrigin, getAuthCallbackUrl } from '@/lib/supabase/auth-url';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

const PROVIDERS = ['google', 'github'] as const;
type Provider = (typeof PROVIDERS)[number];

function isProvider(value: string | null): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

/** Legacy server OAuth entry — prefer client-side startOAuth() on login/signup pages. */
export async function GET(request: NextRequest) {
  const origin = getAppOrigin(request.nextUrl.origin);
  const provider = request.nextUrl.searchParams.get('provider');
  const next = request.nextUrl.searchParams.get('next') ?? '/dashboard';

  if (!isProvider(provider)) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid OAuth provider')}`);
  }

  const { supabase } = await createRouteHandlerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthCallbackUrl(origin, next),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message || 'Could not start OAuth')}`,
    );
  }

  return NextResponse.redirect(data.url);
}
