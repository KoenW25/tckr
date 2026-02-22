'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setSubmitting(true);
    setStatus(null);

    try {
      const { data: existing } = await supabase
        .from('waitlist')
        .select('id')
        .eq('email', trimmed)
        .maybeSingle();

      if (existing) {
        setStatus('exists');
        return;
      }

      const { error } = await supabase
        .from('waitlist')
        .insert({ email: trimmed });

      if (error) {
        if (error.code === '23505') {
          setStatus('exists');
        } else {
          throw error;
        }
      } else {
        setStatus('success');
        setEmail('');
      }
    } catch (err) {
      console.error('Waitlist error:', err);
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 text-7xl">🎟</div>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          We komen eraan
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Tickr wordt de eerlijke markt voor live tickets
        </p>

        <form onSubmit={handleSubmit} className="mt-10 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jouw@email.nl"
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? 'Bezig...' : 'Schrijf me in'}
          </button>
        </form>

        {status === 'success' && (
          <p className="mt-4 text-sm text-emerald-600">
            Bedankt! We houden je op de hoogte.
          </p>
        )}
        {status === 'exists' && (
          <p className="mt-4 text-sm text-amber-600">
            Je staat al op de lijst!
          </p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-sm text-rose-600">
            Er ging iets mis. Probeer het later opnieuw.
          </p>
        )}

        <p className="mt-12 text-xs text-slate-400">
          © {new Date().getFullYear()} Tickr
        </p>
      </div>
    </div>
  );
}
