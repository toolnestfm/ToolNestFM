import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Supabase sometimes redirects to Site URL (/) with ?code= instead of /auth/callback
  const code = request.nextUrl.searchParams.get('code');
  if (code && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

// NOTE: /auth/oauth and /auth/callback are intentionally excluded.
// Middleware session refresh on those routes breaks PKCE cookie exchange.
export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
  ],
};
