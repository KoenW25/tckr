'use client';

import { useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';

export default function Home() {
  const [showPopup, setShowPopup] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [popupError, setPopupError] = useState('');

  const handleReserveer = () => {
    setShowPopup(true);
    setSubmitted(false);
    setEmail('');
    setPopupError('');
  };

  const handleSubmitEmail = async (e) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setPopupError('Vul een geldig e-mailadres in.');
      return;
    }

    setSubmitting(true);
    setPopupError('');

    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({ email });

      if (error) {
        if (error.code === '23505') {
          setSubmitted(true);
          return;
        }
        throw error;
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Waitlist error:', err);
      setPopupError('Er ging iets mis. Probeer het later opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-white text-slate-900">
        {/* Hero */}
        <main className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:py-24 lg:px-8">
          <section className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live tickets, geen gedoe meer met doorverkoop.
            </div>

            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                De eerlijke markt
                <span className="block text-transparent bg-gradient-to-r from-sky-500 via-emerald-500 to-cyan-500 bg-clip-text">
                  voor live tickets
                </span>
              </h1>
              <p className="max-w-xl text-pretty text-base text-slate-600 sm:text-lg">
                Koop en verkoop tickets tegen transparante prijzen, beschermd tegen fraude.
                Tickr koppelt fans direct aan elkaar, met realtime vraag en aanbod.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/markt" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400">
                Bekijk de markt
              </Link>
              <Link href="/upload" className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-6 py-3 text-sm font-medium text-sky-700 hover:border-sky-300 hover:bg-sky-50">
                Ticket verkopen
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-emerald-50 ring-1 ring-emerald-200" />
                <span>Bescherming tegen fraude inbegrepen</span>
              </div>
              <span className="hidden h-3 w-px bg-slate-200 sm:inline" />
              <span>Directe uitbetaling na het event</span>
              <span className="hidden h-3 w-px bg-slate-200 sm:inline" />
              <span>Transparante servicekosten</span>
            </div>
          </section>

          {/* Simple visual side card */}
          <aside className="mt-4 w-full flex-1 lg:mt-0">
            <div className="relative mx-auto max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-lg shadow-slate-200/80">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm shadow-slate-100">
                  🎟 <span className="font-medium text-slate-800">Tickr Live Markt</span>
                </span>
                <span>Vandaag · 124 actieve tickets</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 shadow-sm shadow-slate-100">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Event
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      Festival aan de Rivier
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Floorprijs
                    </p>
                    <p className="text-sm font-semibold text-emerald-500">
                      € 68
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-100">
                    <p className="uppercase tracking-[0.18em] text-slate-400">
                      Vraag
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-500">
                      +12%
                    </p>
                    <p className="text-slate-400">vs. officiële prijs</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-100">
                    <p className="uppercase tracking-[0.18em] text-slate-400">
                      Tickets
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      47 beschikbaar
                    </p>
                    <p className="text-slate-400">Realtime aanbod</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-100">
                    <p className="uppercase tracking-[0.18em] text-slate-400">
                      Vertrouwen
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-500">
                      4.9/5
                    </p>
                    <p className="text-slate-400">Gebaseerd op kopers</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                <span>Word vroegtijdige gebruiker van Tickr.</span>
                <button
                  type="button"
                  onClick={handleReserveer}
                  className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-400"
                >
                  Reserveer je plek
                </button>
              </div>
            </div>
          </aside>
        </main>
      </div>

      {/* Email popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            {submitted ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg">
                  ✓
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Je staat op de lijst!
                </h3>
                <p className="text-sm text-slate-600">
                  We sturen je een e-mail zodra Tickr live gaat. Bedankt voor je interesse!
                </p>
                <button
                  type="button"
                  onClick={() => setShowPopup(false)}
                  className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400"
                >
                  Sluiten
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Reserveer je plek
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPopup(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-slate-600">
                  Laat je e-mailadres achter en wij laten je weten zodra Tickr live gaat.
                </p>

                {popupError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {popupError}
                  </div>
                )}

                <form onSubmit={handleSubmitEmail} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jij@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {submitting ? 'Bezig met inschrijven...' : 'Inschrijven'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
