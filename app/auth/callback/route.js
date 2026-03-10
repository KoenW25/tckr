import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendWelcomeEmail } from '@/lib/email';

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

function isUserNew(createdAt) {
  if (!createdAt) return false;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= 60 * 1000;
}

function getDisplayName(user) {
  const meta = user?.user_metadata || {};
  const fullName = meta.full_name || meta.name || meta.given_name || '';
  if (String(fullName).trim()) return String(fullName).trim();
  const email = user?.email || '';
  if (!email.includes('@')) return 'daar';
  return email.split('@')[0];
}

async function sendWelcomeEmailForFirstLogin(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isUserNew(user.created_at)) return;
  const name = getDisplayName(user);
  try {
    await sendWelcomeEmail(user.email, name);
  } catch (error) {
    // Do not block login if email delivery fails.
    console.error('[Auth Callback] Welcome email failed:', error);
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const supabase = await createSupabaseServerClient();

  try {
    if (code) {
      // OAuth started from the browser client uses PKCE and should exchange
      // the code client-side on /login where supabase-js has the verifier.
      const loginUrl = new URL('/login', url.origin);
      loginUrl.search = url.search;
      return NextResponse.redirect(loginUrl);
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        console.error('[Auth Callback] verifyOtp failed:', error);
        return NextResponse.redirect(new URL('/login', url.origin));
      }
      await sendWelcomeEmailForFirstLogin(supabase);
      return NextResponse.redirect(new URL('/dashboard', url.origin));
    }
  } catch (error) {
    console.error('[Auth Callback] Session exchange failed:', error);
  }

  return NextResponse.redirect(new URL('/login', url.origin));
}
