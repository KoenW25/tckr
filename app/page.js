'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';
import supabase from '@/lib/supabase';
import { formatPrice } from '@/lib/fees';
import { eventToSlug } from '@/lib/eventSlug';

export default function Home() {
  const { lang } = useLanguage();
  const [previewEvents, setPreviewEvents] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPreviewEvents() {
      setPreviewLoading(true);
      try {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('id, name, date, city')
          .order('date', { ascending: true })
          .limit(30);

        if (eventsError) throw eventsError;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const events = (eventsData ?? [])
          .filter((event) => {
            if (!event?.date) return true;
            const eventDate = new Date(event.date);
            if (Number.isNaN(eventDate.getTime())) return true;
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today;
          })
          .slice(0, 3);
        if (events.length === 0) {
          if (isMounted) setPreviewEvents([]);
          return;
        }

        const eventIds = events.map((event) => Number(event.id)).filter((value) => Number.isInteger(value));

        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('id, event_id, ask_price, is_private')
          .in('event_id', eventIds)
          .eq('status', 'available')
          .not('ask_price', 'is', null)
          .or('is_private.is.null,is_private.eq.false');

        const { data: bidsData } = await supabase
          .from('bids')
          .select('event_id, bid_price')
          .in('event_id', eventIds)
          .eq('status', 'pending');

        const ticketMap = {};
        for (const ticket of ticketsData ?? []) {
          const eventId = Number(ticket.event_id);
          const ask = Number(ticket.ask_price);
          if (!Number.isInteger(eventId) || !Number.isFinite(ask)) continue;
          if (!ticketMap[eventId]) {
            ticketMap[eventId] = {
              lowestAsk: null,
              cheapestTicketId: null,
            };
          }
          if (ticketMap[eventId].lowestAsk == null || ask < ticketMap[eventId].lowestAsk) {
            ticketMap[eventId].lowestAsk = ask;
            ticketMap[eventId].cheapestTicketId = Number(ticket.id);
          }
        }

        const highestBidMap = {};
        for (const bid of bidsData ?? []) {
          const eventId = Number(bid.event_id);
          const bidValue = Number(bid.bid_price);
          if (!Number.isInteger(eventId) || !Number.isFinite(bidValue)) continue;
          if (highestBidMap[eventId] == null || bidValue > highestBidMap[eventId]) {
            highestBidMap[eventId] = bidValue;
          }
        }

        const enriched = events.map((event) => ({
          ...event,
          lowestAsk: ticketMap[event.id]?.lowestAsk ?? null,
          cheapestTicketId: ticketMap[event.id]?.cheapestTicketId ?? null,
          highestBid: highestBidMap[event.id] ?? null,
        }));

        if (isMounted) setPreviewEvents(enriched);
      } catch (error) {
        console.error('Home preview events error:', error);
        if (isMounted) setPreviewEvents([]);
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    }

    loadPreviewEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  const previewDateLocale = lang === 'nl' ? 'nl-NL' : 'en-GB';
  const howItWorksCards = useMemo(
    () => [
      {
        number: '01',
        title: t('home.how.card1.title', lang),
        description: t('home.how.card1.description', lang),
        tag: t('home.how.card1.tag', lang),
        tagBg: '#eef7f1',
        tagColor: '#1a6b3c',
        iconBg: 'bg-emerald-50',
        icon: '💳',
      },
      {
        number: '02',
        title: t('home.how.card2.title', lang),
        description: t('home.how.card2.description', lang),
        tag: t('home.how.card2.tag', lang),
        tagBg: '#e6f1fb',
        tagColor: '#185FA5',
        iconBg: 'bg-sky-50',
        icon: '⏃',
      },
      {
        number: '03',
        title: t('home.how.card3.title', lang),
        description: t('home.how.card3.description', lang),
        tag: t('home.how.card3.tag', lang),
        tagBg: '#f3f4f6',
        tagColor: '#475569',
        iconBg: 'bg-slate-100',
        icon: '↓',
      },
    ],
    [lang]
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero */}
      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:py-16 lg:px-8">
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

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 sm:flex-nowrap sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-emerald-50 ring-1 ring-emerald-200" />
                <span className="sm:whitespace-nowrap">{t('home.featureFraud', lang)}</span>
              </div>
              <span className="h-3 w-px bg-slate-200" />
              <span className="sm:whitespace-nowrap">{t('home.featurePayout', lang)}</span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="sm:whitespace-nowrap">{t('home.featureFees', lang)}</span>
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

      <section
        className="border-y border-slate-200"
        style={{ borderTopWidth: '0.5px', borderBottomWidth: '0.5px' }}
      >
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-14 lg:px-8">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('home.how.label', lang)}</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
              {t('home.how.title', lang)}
            </h2>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {howItWorksCards.map((card) => (
              <article
                key={card.number}
                className="rounded-[12px] border border-slate-200 bg-white p-7"
                style={{ borderWidth: '0.5px' }}
              >
                <p className="text-2xl text-slate-700">{card.number}</p>
                <div className={`mt-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <span className="text-xl">{card.icon}</span>
                </div>
                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-slate-700">{card.description}</p>
                <span
                  className="mt-5 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: card.tagBg, color: card.tagColor }}
                >
                  {card.tag}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200" style={{ borderTopWidth: '0.5px' }}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-200 pb-4" style={{ borderBottomWidth: '0.5px' }}>
            <h3 className="text-2xl tracking-tight text-slate-900">{t('home.preview.title', lang)}</h3>
            <Link href="/markt" className="text-sm text-slate-700 transition hover:text-slate-900">
              {t('home.preview.viewAll', lang)}
            </Link>
          </div>

          {previewLoading ? (
            <p className="py-6 text-sm text-slate-500">{t('common.loading', lang)}</p>
          ) : previewEvents.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">{t('home.preview.empty', lang)}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {previewEvents.map((event) => {
                const eventDate = event.date
                  ? new Date(event.date).toLocaleDateString(previewDateLocale, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : t('home.preview.unknownDate', lang);
                const location = event.city || t('home.preview.unknownCity', lang);
                const detailHref = `/markt/${eventToSlug(event)}`;
                const buyHref = event.cheapestTicketId ? `/checkout/${event.cheapestTicketId}` : detailHref;
                return (
                  <article
                    key={event.id}
                    className="rounded-[12px] border border-slate-200 bg-white p-5"
                    style={{ borderWidth: '0.5px' }}
                  >
                    <Link href={detailHref} className="text-3xl font-medium uppercase tracking-tight text-slate-900 hover:underline">
                      {event.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      {eventDate} · {location}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-100 p-3">
                        <p className="uppercase tracking-[0.14em] text-slate-600">{t('home.preview.buyNow', lang)}</p>
                        <p className="mt-1 text-3xl font-semibold" style={{ color: '#c0392b' }}>
                          {event.lowestAsk != null ? `€${formatPrice(event.lowestAsk)}` : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-100 p-3">
                        <p className="uppercase tracking-[0.14em] text-slate-600">{t('home.preview.highestBid', lang)}</p>
                        <p className="mt-1 text-3xl font-semibold" style={{ color: '#1a6b3c' }}>
                          {event.highestBid != null ? `€${formatPrice(event.highestBid)}` : '—'}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={buyHref}
                      className="mt-4 block rounded-full bg-emerald-500 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400"
                    >
                      {t('market.buyTicketBtn', lang)} →
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
