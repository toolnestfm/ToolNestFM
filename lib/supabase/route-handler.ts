import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';

type PendingCookie = { name: string; value: string; options: CookieOptions };

/** Supabase client for Route Handlers — uses next/headers cookies (required for PKCE on Next.js 15). */
export async function createRouteHandlerClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error('Missing Supabase environment variables.');

  const cookieStore = await cookies();

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: PendingCookie[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, {
              ...options,
              path: options?.path ?? '/',
              sameSite: options?.sameSite ?? 'lax',
              secure: options?.secure ?? process.env.NODE_ENV === 'production',
            });
          } catch {
            /* cookieStore.set can throw when called from a Server Component context */
          }
        });
      },
    },
  });

  return { supabase };
}
