'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const existingConsent = localStorage.getItem('cookie_consent');
      setVisible(!existingConsent);
    } catch {
      setVisible(true);
    }
  }, []);

  const saveConsent = (value) => {
    try {
      localStorage.setItem('cookie_consent', value);
      if (value === 'accepted') {
        localStorage.setItem(
          'cookie_preferences',
          JSON.stringify({
            necessary: true,
            analytics: true,
            marketing: true,
          })
        );
      } else {
        localStorage.setItem(
          'cookie_preferences',
          JSON.stringify({
            necessary: true,
            analytics: false,
            marketing: false,
          })
        );
      }
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white shadow-2xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-sm text-slate-700">
          Tckr gebruikt cookies voor een goede werking van het platform en om je ervaring te verbeteren. Lees meer in ons{' '}
          <Link href="/privacy" className="font-medium text-sky-700 underline hover:text-sky-600">
            privacybeleid
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => saveConsent('minimal')}
            className="rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Alleen noodzakelijk
          </button>
          <button
            type="button"
            onClick={() => saveConsent('accepted')}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-400"
          >
            Alles accepteren
          </button>
        </div>
      </div>
    </div>
  );
}
