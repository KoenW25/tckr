'use client';

import { useEffect, useState } from 'react';

function Toggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={`relative h-7 w-12 rounded-full transition ${
            checked ? 'bg-emerald-500' : 'bg-slate-300'
          } ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          aria-label={label}
          aria-pressed={checked}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
              checked ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export default function CookieSettingsPage() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    try {
      const rawPrefs = localStorage.getItem('cookie_preferences');
      const consent = localStorage.getItem('cookie_consent');

      if (rawPrefs) {
        const prefs = JSON.parse(rawPrefs);
        setAnalytics(Boolean(prefs.analytics));
        setMarketing(Boolean(prefs.marketing));
        return;
      }

      if (consent === 'accepted') {
        setAnalytics(true);
        setMarketing(true);
      } else {
        setAnalytics(false);
        setMarketing(false);
      }
    } catch {
      setAnalytics(false);
      setMarketing(false);
    }
  }, []);

  const handleSave = () => {
    const preferences = {
      necessary: true,
      analytics,
      marketing,
    };

    try {
      localStorage.setItem('cookie_preferences', JSON.stringify(preferences));
      localStorage.setItem('cookie_consent', analytics || marketing ? 'accepted' : 'minimal');
      setSavedMessage('Je cookievoorkeuren zijn opgeslagen.');
    } catch {
      setSavedMessage('Er ging iets mis bij het opslaan van je voorkeuren.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Cookie-instellingen
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Beheer hier je voorkeuren voor cookies op Tckr. Noodzakelijke cookies blijven altijd actief om het platform goed te laten werken.
        </p>

        <div className="mt-6 space-y-3">
          <Toggle
            label="Noodzakelijke cookies"
            description="Deze cookies zijn nodig voor basisfunctionaliteit zoals inloggen, beveiliging en sessiebeheer."
            checked={true}
            onChange={() => {}}
            disabled
          />
          <Toggle
            label="Analytische cookies"
            description="Deze cookies helpen ons om het gebruik van het platform te meten en de ervaring te verbeteren."
            checked={analytics}
            onChange={setAnalytics}
          />
          <Toggle
            label="Marketing cookies"
            description="Deze cookies worden gebruikt om relevante content en campagnes te tonen."
            checked={marketing}
            onChange={setMarketing}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400"
          >
            Opslaan
          </button>
          {savedMessage && (
            <p className="text-xs text-slate-600">{savedMessage}</p>
          )}
        </div>
      </main>
    </div>
  );
}
