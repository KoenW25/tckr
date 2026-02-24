'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';

export default function ComingSoonPage() {
  const { lang } = useLanguage();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [warning, setWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setSubmitting(true);
    setStatus(null);
    setWarning('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Wachtlijst-aanmelding mislukt.');
      }

      if (json?.status === 'exists') {
        setStatus('exists');
      } else if (json?.status === 'success_no_email') {
        setStatus('success');
        setWarning(
          json?.warning ||
            'Je staat op de wachtlijst, maar de bevestigingsmail kon niet worden verstuurd.'
        );
        setEmail('');
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
          {t('soon.title', lang)}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {t('soon.subtitle', lang)}
        </p>

        <form onSubmit={handleSubmit} className="mt-10 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('soon.placeholder', lang)}
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? t('soon.submitting', lang) : t('soon.submit', lang)}
          </button>
        </form>

        {status === 'success' && (
          <p className="mt-4 text-sm text-emerald-600">
            {t('soon.success', lang)}
          </p>
        )}
        {status === 'exists' && (
          <p className="mt-4 text-sm text-amber-600">
            {t('soon.exists', lang)}
          </p>
        )}
        {warning && (
          <p className="mt-2 text-sm text-amber-600">{warning}</p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-sm text-rose-600">
            {t('soon.error', lang)}
          </p>
        )}

        <p className="mt-12 text-xs text-slate-400">
          © {new Date().getFullYear()} Tckr
        </p>
        <a
          href="/login"
          className="mt-4 inline-block text-xs text-slate-400 underline hover:text-slate-600"
        >
          {t('soon.teamLogin', lang)}
        </a>
      </div>
    </div>
  );
}
