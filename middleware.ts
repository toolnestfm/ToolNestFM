import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Supabase sometimes redirects to Site URL (/) with ?code= instead of /auth/callback
  const code = request.nextUrl.searchParams.get('code');
  if (code && (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    '/',
    '/auth/callback',
    '/dashboard/:path*',
    '/login',
    '/signup',
  ],
};
