'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDevMode = searchParams.get('dev') === 'true';

  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devError, setDevError] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    router.push('/dashboard');
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

      if (error) {
        if (error.message === 'Invalid login credentials') {
          const { error: signUpError } = await supabase.auth.signUp({
            email: devEmail,
            password: devPassword,
          });
          if (signUpError) throw signUpError;
        } else {
          throw error;
        }
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Dev login error:', err);
      setDevError(err.message || 'Login mislukt.');
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
            <span>Tickr</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            De eerlijke markt voor live tickets.
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            Log in en beheer je tickets, orders en uitbetalingen op één plek.
          </p>

          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/20 text-center text-xs text-emerald-300">
                ✓
              </span>
              <span>Bescherming tegen fraude bij elke transactie.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-sky-500/20 text-center text-xs text-sky-200">
                ✓
              </span>
              <span>Transparante prijzen met een open orderboek.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500/20 text-center text-xs text-emerald-300">
                ✓
              </span>
              <span>Snelle uitbetaling na het event op je IBAN.</span>
            </li>
          </ul>
        </section>

        {/* Rechter: login formulier */}
        <section className="flex-1 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-md shadow-slate-200/60 sm:px-8">
          <h2 className="text-lg font-semibold text-slate-900">
            Log in op Tickr
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Gebruik je favoriete account of ontvang een magic link per e-mail.
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="text-lg">G</span>
              <span>Inloggen met Google</span>
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-50">
              <span className="text-lg">Ⓜ</span>
              <span>Inloggen met Meta</span>
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>of met e-mail</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                E-mailadres
              </label>
              <input
                type="email"
                placeholder="jij@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400"
            >
              Magic link versturen
            </button>

            <p className="mt-3 text-xs text-slate-500">
              Door in te loggen ga je akkoord met onze{' '}
              <Link href="/voorwaarden" className="text-sky-600 hover:underline">
                voorwaarden
              </Link>{' '}
              en{' '}
              <Link href="/privacy" className="text-sky-600 hover:underline">
                privacyverklaring
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
                    E-mail
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
                    Wachtwoord
                  </label>
                  <input
                    type="password"
                    value={devPassword}
                    onChange={(e) => setDevPassword(e.target.value)}
                    placeholder="Minimaal 6 tekens"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={devLoading}
                  className="mt-2 w-full rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-500/30 hover:bg-amber-400 disabled:opacity-60"
                >
                  {devLoading ? 'Bezig...' : 'Dev login / registreer'}
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

