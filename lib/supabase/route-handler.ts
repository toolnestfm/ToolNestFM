import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseEnv } from './env';

type PendingCookie = { name: string; value: string; options: CookieOptions };

/** Supabase client for Route Handlers — PKCE verifier stored in httpOnly cookies. */
export function createRouteHandlerClient(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) throw new Error('Missing Supabase environment variables.');

  const pending: PendingCookie[] = [];

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: PendingCookie[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        pending.push(...cookiesToSet);
      },
    },
  });

  function applyCookies<T extends NextResponse>(response: T): T {
    pending.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return { supabase, applyCookies };
}
