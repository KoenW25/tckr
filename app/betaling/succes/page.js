'use client';

import Link from 'next/link';

export default function BetalingSuccesPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center sm:px-6">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          🎉
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Gelukt! Je ticket is gekocht 🎉
        </h1>

        <p className="mt-4 text-sm text-slate-600">
          Je betaling is verwerkt. Je ticket is beschikbaar in je dashboard.
        </p>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          Ga naar mijn dashboard
        </Link>
      </main>
    </div>
  );
}
