import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/supabase/auth-url';

type OAuthProvider = 'google' | 'github';

/** Start OAuth in the browser so PKCE verifier is stored in cookies before leaving the site. */
export async function startOAuth(provider: OAuthProvider, next = '/dashboard'): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthCallbackUrl(origin, next),
    },
  });

  if (error) throw error;
}
