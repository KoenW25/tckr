'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';
import supabase from '@/lib/supabase';

function LoginContent() {
  const { lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDevMode = searchParams.get('dev') === 'true';

  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState('');

  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devError, setDevError] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function redirectIfSessionExists() {
      const { data } = await supabase.auth.getSession();
      if (mounted && data?.session) {
        router.replace('/dashboard');
      }
    }

    redirectIfSessionExists();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        router.replace('/dashboard');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleMagicLink = async (e) => {
    e.preventDefault();
    const normalizedEmail = magicEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    setMagicError('');
    setMagicSent(false);
    if (!emailRegex.test(normalizedEmail)) {
      setMagicError('Voer een geldig e-mailadres in.');
      return;
    }

    try {
      setMagicLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: 'https://tckr.nl/auth/callback',
        },
      });

      if (error) throw error;
      setMagicEmail(normalizedEmail);
      setMagicSent(true);
    } catch (err) {
      console.error('Magic link error:', err);
      setMagicError(err.message || t('login.failed', lang));
    } finally {
      setMagicLoading(false);
    }
  };

  const handleDevLogin = async (e) => {
    e.preventDefault();
    setDevError('');
    setDevLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: devEmail,
        password: devPassword,
      });

      let isNewUser = false;

      if (error) {
        if (error.message === 'Invalid login credentials') {
          const { error: signUpError } = await supabase.auth.signUp({
            email: devEmail,
            password: devPassword,
          });
          if (signUpError) throw signUpError;
          isNewUser = true;
        } else {
          throw error;
        }
      }

      if (isNewUser) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            fetch('/api/email/welcome', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch {}
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Dev login error:', err);
      setDevError(err.message || t('login.failed', lang));
    } finally {
      setDevLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Google login error:', error.message);
      }
    } catch (err) {
      console.error('Unexpected Google login error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col px-4 py-10 sm:px-6 lg:flex-row lg:py-16 lg:px-8">
        {/* Linker paneel */}
        <section className="mb-8 flex-1 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl shadow-slate-900/40 lg:mb-0 lg:mr-8 lg:px-8 lg:py-10">
          <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="text-xl">🎟</span>
            <span>Tckr</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('login.heroTitle', lang)}
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            {t('login.heroSub', lang)}
          </p>

          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/20 text-center text-xs text-emerald-300">
                ✓
              </span>
              <span>{t('login.feature1', lang)}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-sky-500/20 text-center text-xs text-sky-200">
                ✓
              </span>
              <span>{t('login.feature2', lang)}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/20 text-center text-xs text-emerald-300">
                ✓
              </span>
              <span>{t('login.feature3', lang)}</span>
            </li>
          </ul>
        </section>

        {/* Rechter: login formulier */}
        <section className="flex-1 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-md shadow-slate-200/60 sm:px-8">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('login.title', lang)}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t('login.subtitle', lang)}
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="text-lg">G</span>
              <span>{t('login.google', lang)}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>Of log in met een magic link</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form className="space-y-4 text-sm" onSubmit={handleMagicLink}>
            {magicSent ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <p className="text-sm font-medium text-emerald-800">
                  Check je inbox! We hebben een magic link gestuurd naar {magicEmail}. De link is 10 minuten geldig.
                </p>
              </div>
            ) : (
              <>
                {magicError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {magicError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    {t('login.email', lang)}
                  </label>
                  <input
                    type="email"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    placeholder="jouw@email.nl"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={magicLoading}
                  className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {magicLoading ? t('login.magicSending', lang) : 'Stuur magic link'}
                </button>
              </>
            )}

            <p className="mt-3 text-xs text-slate-500">
              {t('login.terms', lang)}{' '}
              <Link href="/voorwaarden" className="text-sky-600 hover:underline">
                {t('login.termsLink', lang)}
              </Link>{' '}
              {t('login.and', lang)}{' '}
              <Link href="/privacy" className="text-sky-600 hover:underline">
                {t('login.privacyLink', lang)}
              </Link>
              .
            </p>
          </form>

          {isDevMode && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-amber-700">DEV</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form className="space-y-4 text-sm" onSubmit={handleDevLogin}>
                {devError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {devError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    {t('login.devEmail', lang)}
                  </label>
                  <input
                    type="email"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    placeholder="dev@test.com"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    {t('login.devPassword', lang)}
                  </label>
                  <input
                    type="password"
                    value={devPassword}
                    onChange={(e) => setDevPassword(e.target.value)}
                    placeholder={t('login.devPasswordPlaceholder', lang)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={devLoading}
                  className="mt-2 w-full rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-500/30 hover:bg-amber-400 disabled:opacity-60"
                >
                  {devLoading ? t('login.devSubmitting', lang) : t('login.devSubmit', lang)}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

