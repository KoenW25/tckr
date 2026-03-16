'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';

export default function Home() {
  const { lang } = useLanguage();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero */}
      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:py-24 lg:px-8">
        <section className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t('home.badge', lang)}
          </div>

            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                {t('home.titlePart1', lang)}
                <span
                  className="block bg-clip-text text-transparent"
                  style={{
                    background: 'linear-gradient(90deg, #1a6b3c 0%, #00b894 50%, #0984e3 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t('home.titlePart2', lang)}
                </span>
              </h1>
              <p className="max-w-xl text-pretty text-base text-slate-600 sm:text-lg">
                {t('home.subtitle', lang)}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/markt" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400">
                {t('home.viewMarket', lang)}
              </Link>
              <Link href="/upload" className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-6 py-3 text-sm font-medium text-sky-700 hover:border-sky-300 hover:bg-sky-50">
                {t('home.sellTicket', lang)}
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-emerald-50 ring-1 ring-emerald-200" />
                <span>{t('home.featureFraud', lang)}</span>
              </div>
              <span className="hidden h-3 w-px bg-slate-200 sm:inline" />
              <span>{t('home.featurePayout', lang)}</span>
              <span className="hidden h-3 w-px bg-slate-200 sm:inline" />
              <span>{t('home.featureFees', lang)}</span>
            </div>
          </section>

          {/* Simple visual side card */}
          <aside className="mt-4 w-full flex-1 lg:mt-0">
            <div className="relative mx-auto max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-lg shadow-slate-200/80">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm shadow-slate-100">
                  🎟 <span className="font-medium text-slate-800">{t('home.marketPreview', lang)}</span>
                </span>
                <span>{t('home.today', lang)} · 124 {t('home.activeTickets', lang)}</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 shadow-sm shadow-slate-100">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {t('home.event', lang)}
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {t('home.festivalName', lang)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {t('home.floorPrice', lang)}
                    </p>
                    <p className="text-sm font-semibold text-emerald-500">
                      € 68
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-100">
                    <p className="uppercase tracking-[0.18em] text-slate-400">
                      {t('market.cardBuyNowFrom', lang)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-rose-600">
                      €42
                    </p>
                    <p className="text-slate-400">3 {t('home.ticketsLabel', lang).toLowerCase()}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-100">
                    <p className="uppercase tracking-[0.18em] text-slate-400">
                      {t('market.cardHighestBid', lang)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-600">
                      €35
                    </p>
                    <p className="text-slate-400">2 {t('market.bidUnitPlural', lang)}</p>
                  </div>
                </div>
              </div>

              <Link
                href="/markt"
                className="mt-4 block rounded-2xl bg-slate-900 px-3 py-2 text-center text-base text-white transition hover:bg-slate-800"
              >
                {t('market.buyTicketBtn', lang)} →
              </Link>

              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                <Link href="/markt" className="hover:text-slate-900">
                  {t('market.placeBidBtn', lang)}
                </Link>
                <Link href="/markt" className="text-right hover:text-slate-900">
                  {t('market.viewOrderbook', lang)}
                </Link>
              </div>

            </div>
          </aside>
      </main>
    </div>
  );
}
