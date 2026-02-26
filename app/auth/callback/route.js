import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );
}

async function sendWelcomeEmailIfPossible(supabase, request) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const origin = new URL(request.url).origin;
  await fetch(`${origin}/api/email/welcome`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => {});
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const supabase = await createSupabaseServerClient();

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
      await sendWelcomeEmailIfPossible(supabase, request);
      return NextResponse.redirect(new URL('/dashboard', url.origin));
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (!error) {
        await sendWelcomeEmailIfPossible(supabase, request);
        return NextResponse.redirect(new URL('/dashboard', url.origin));
      }
    }
  } catch (error) {
    console.error('[Auth Callback] Session exchange failed:', error);
  }

  return NextResponse.redirect(new URL('/login', url.origin));
}
