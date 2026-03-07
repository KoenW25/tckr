'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { calculateBuyerTotal, formatPrice } from '@/lib/fees';

export default function MarktPage() {
  const { lang } = useLanguage();
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData?.user ?? null);

      const { data: events, error: eventsErr } = await supabase
        .from('events')
        .select('id, name, date, venue, venue_name, city, country_code')
        .order('date', { ascending: true });

      if (eventsErr) throw eventsErr;

      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, event_id, ask_price, status, verified, is_private')
        .eq('status', 'available')
        .not('ask_price', 'is', null)
        .or('is_private.is.null,is_private.eq.false');

      const ticketIds = (tickets ?? []).map((tk) => tk.id);

      let ticketBidMap = {};
      if (ticketIds.length > 0) {
        const { data: ticketBids } = await supabase
          .from('bids')
          .select('ticket_id, bid_price')
          .in('ticket_id', ticketIds)
          .eq('status', 'pending');

        for (const bid of ticketBids ?? []) {
          if (!ticketBidMap[bid.ticket_id] || bid.bid_price > ticketBidMap[bid.ticket_id]) {
            ticketBidMap[bid.ticket_id] = Number(bid.bid_price);
          }
        }
      }

      const eventIds = (events ?? []).map((e) => e.id);
      let eventBidMap = {};
      if (eventIds.length > 0) {
        const { data: eventBids } = await supabase
          .from('bids')
          .select('event_id, bid_price')
          .in('event_id', eventIds)
          .eq('status', 'pending');

        for (const bid of eventBids ?? []) {
          if (!eventBidMap[bid.event_id]) eventBidMap[bid.event_id] = [];
          eventBidMap[bid.event_id].push(Number(bid.bid_price));
        }
      }

      const ticketMap = {};
      for (const t of tickets ?? []) {
        if (!t.event_id) continue;
        if (!ticketMap[t.event_id]) {
          ticketMap[t.event_id] = {
            askPrices: [],
            bidPrices: [],
            count: 0,
            verifiedCount: 0,
          };
        }
        ticketMap[t.event_id].askPrices.push(Number(t.ask_price));
        ticketMap[t.event_id].count++;
        if (t.verified === 'verified') {
          ticketMap[t.event_id].verifiedCount++;
        }
        if (ticketBidMap[t.id] != null) {
          ticketMap[t.event_id].bidPrices.push(ticketBidMap[t.id]);
        }
      }

      const cards = (events ?? []).map((ev) => {
        const td = ticketMap[ev.id] || { askPrices: [], bidPrices: [], count: 0, verifiedCount: 0 };
        const allBids = [...td.bidPrices, ...(eventBidMap[ev.id] || [])];
        const lowestAsk = td.askPrices.length > 0 ? Math.min(...td.askPrices) : null;
        const highestBid = allBids.length > 0 ? Math.max(...allBids) : null;
        return {
          ...ev,
          lowestAsk,
          highestBid,
          ticketCount: td.count,
          bidCount: allBids.length,
          verifiedCount: td.verifiedCount,
        };
      });

      setEventCards(cards);
    } catch (err) {
      console.error(t('market.fetchError', lang), err);
      setError(t('market.fetchError', lang));
    } finally {
      setLoading(false);
    }
  }

  const cityOptions = useMemo(
    () =>
      Array.from(new Set(eventCards.map((ev) => ev.city).filter(Boolean))).sort((a, b) =>
        String(a).localeCompare(String(b), 'nl')
      ),
    [eventCards]
  );

  const venueOptions = useMemo(
    () =>
      Array.from(
        new Set(
          eventCards
            .map((ev) => ev.venue_name || ev.venue)
            .filter(Boolean)
        )
      ).sort((a, b) => String(a).localeCompare(String(b), 'nl')),
    [eventCards]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const endOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };
    const parseEventDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const getWeekendRange = (weekOffset = 0) => {
      const now = new Date();
      const today = startOfDay(now);
      const day = today.getDay();
      let saturday = new Date(today);
      if (day === 6) {
        // today is Saturday
      } else if (day === 0) {
        // today is Sunday -> include current weekend
        saturday.setDate(saturday.getDate() - 1);
      } else {
        saturday.setDate(saturday.getDate() + (6 - day));
      }
      saturday.setDate(saturday.getDate() + weekOffset * 7);
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      return { start: startOfDay(saturday), end: endOfDay(sunday) };
    };

    return eventCards
      .filter((ev) => {
        if (q) {
          const matchSearch =
            ev.name?.toLowerCase().includes(q) ||
            ev.venue?.toLowerCase().includes(q) ||
            ev.venue_name?.toLowerCase().includes(q) ||
            ev.city?.toLowerCase().includes(q) ||
            ev.country_code?.toLowerCase().includes(q);
          if (!matchSearch) return false;
        }

        if (filterCity && String(ev.city || '') !== filterCity) return false;

        const venueLabel = ev.venue_name || ev.venue || '';
        if (filterVenue && String(venueLabel) !== filterVenue) return false;

        if (dateFilter !== 'all') {
          const eventDate = parseEventDate(ev.date);
          if (!eventDate) return false;

          if (dateFilter === 'thisWeekend') {
            const range = getWeekendRange(0);
            if (eventDate < range.start || eventDate > range.end) return false;
          } else if (dateFilter === 'nextWeekend') {
            const range = getWeekendRange(1);
            if (eventDate < range.start || eventDate > range.end) return false;
          } else if (dateFilter === 'custom') {
            if (!customDate) return false;
            const custom = parseEventDate(customDate);
            if (!custom) return false;
            if (startOfDay(eventDate).getTime() !== startOfDay(custom).getTime()) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.name || '').localeCompare(String(b.name || ''), 'nl');
      });
  }, [eventCards, search, filterCity, filterVenue, dateFilter, customDate]);

  const showNoResults = search.trim() && filtered.length === 0 && !loading;

  const handleAddEvent = async () => {
    if (!newEventName.trim()) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }

    setAddingEvent(true);
    try {
      const { data, error: insertErr } = await supabase
        .from('events')
        .insert({
          name: newEventName.trim(),
          date: newEventDate || null,
          venue: newEventVenue.trim() || null,
        })
        .select('id, name, date, venue, venue_name, city, country_code')
        .single();

      if (insertErr) throw insertErr;

      setEventCards((prev) => [
        ...prev,
        { ...data, lowestAsk: null, highestBid: null, ticketCount: 0, bidCount: 0 },
      ]);
      setSearch('');
      setShowAddEvent(false);
      setNewEventName('');
      setNewEventDate('');
      setNewEventVenue('');
    } catch (err) {
      console.error('Error adding event:', err);
    } finally {
      setAddingEvent(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t('market.title', lang)}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('market.subtitle', lang)}
          </p>
        </div>

        {/* Zoekbalk */}
        <div className="relative mb-8" ref={searchRef}>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm shadow-slate-100">
            <span className="text-slate-400">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowAddEvent(false);
              }}
              placeholder={t('market.searchPlaceholder', lang)}
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            >
              {t('market.filter', lang)}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  {t('market.place', lang)}
                </label>
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                >
                  <option value="">{t('market.allPlaces', lang)}</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  {t('market.venueLabel', lang)}
                </label>
                <select
                  value={filterVenue}
                  onChange={(e) => setFilterVenue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                >
                  <option value="">{t('market.allVenues', lang)}</option>
                  {venueOptions.map((venue) => (
                    <option key={venue} value={venue}>
                      {venue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  {t('market.dateFilter', lang)}
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                >
                  <option value="all">{t('market.allDates', lang)}</option>
                  <option value="thisWeekend">{t('market.thisWeekend', lang)}</option>
                  <option value="nextWeekend">{t('market.nextWeekend', lang)}</option>
                  <option value="custom">{t('market.customDate', lang)}</option>
                </select>
              </div>

              {dateFilter === 'custom' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    {t('market.pickDate', lang)}
                  </label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
              )}

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setFilterCity('');
                    setFilterVenue('');
                    setDateFilter('all');
                    setCustomDate('');
                  }}
                  className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  {t('market.clearFilters', lang)}
                </button>
              </div>
            </div>
          )}

          {showNoResults && !showAddEvent && (
            <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
              <p className="mb-3 text-center text-xs text-slate-400">
                {t('market.noResults', lang)} "{search}"
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewEventName(search.trim());
                  setShowAddEvent(true);
                }}
                className="w-full rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400"
              >
                {t('market.addEvent', lang)}
              </button>
            </div>
          )}

          {showAddEvent && (
            <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                {t('market.addEventTitle', lang)}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('market.name', lang)}</label>
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder={t('market.namePlaceholder', lang)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('market.date', lang)}</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('market.location', lang)}</label>
                  <input
                    type="text"
                    value={newEventVenue}
                    onChange={(e) => setNewEventVenue(e.target.value)}
                    placeholder={t('market.locationPlaceholder', lang)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('market.cancel', lang)}
                </button>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  disabled={addingEvent || !newEventName.trim()}
                  className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400 disabled:opacity-60"
                >
                  {addingEvent ? t('market.saving', lang) : t('market.addEventBtn', lang)}
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && <p className="text-center text-slate-500">{t('market.loading', lang)}</p>}
        {error && <p className="text-center text-rose-600">{error}</p>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ev) => (
            <EventCard key={ev.id} event={ev} lang={lang} />
          ))}
        </section>

        {!loading && !search.trim() && eventCards.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {t('market.empty', lang)}
          </p>
        )}
      </main>
    </div>
  );
}

function EventCard({ event, lang }) {
  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const hasTickets = event.ticketCount > 0;
  const isExpired = event.date && new Date(event.date) < new Date(new Date().toDateString());
  const locationText = [event.city, event.venue_name || event.venue, event.country_code]
    .filter(Boolean)
    .join(' - ');

  return (
    <Link href={`/markt/${event.id}`} className="block">
      <article className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isExpired ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white shadow-slate-100'}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className={`text-sm font-semibold ${isExpired ? 'text-slate-400' : 'text-slate-900'}`}>{event.name}</h2>
            {event.verifiedCount > 0 && (
              <span
                title={t('market.verified', lang)}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-600 ring-1 ring-emerald-200"
              >
                ✓
              </span>
            )}
            {isExpired && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                {t('market.expired', lang)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {formattedDate && <span>{formattedDate}</span>}
            {formattedDate && locationText && <span className="text-slate-300">·</span>}
            {locationText && <span>{locationText}</span>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-100">
            <p className="uppercase tracking-[0.18em] text-rose-600">
              <span>{t('market.ask', lang)}</span>{' '}
              <span className="text-[9px] normal-case tracking-normal text-rose-400">
                ({t('market.askDetail', lang)})
              </span>
            </p>
            <p className="mt-1 text-sm font-semibold text-rose-700">
              {event.lowestAsk != null ? `€ ${formatPrice(event.lowestAsk)}` : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-rose-400">
              {hasTickets ? t('market.lowestAsk', lang) : t('market.noSupply', lang)}
            </p>
          </div>
          <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100">
            <p className="uppercase tracking-[0.18em] text-sky-600">
              <span>{t('market.bid', lang)}</span>{' '}
              <span className="text-[9px] normal-case tracking-normal text-sky-400">
                ({t('market.bidDetail', lang)})
              </span>
            </p>
            <p className="mt-1 text-sm font-semibold text-sky-700">
              {event.highestBid != null ? `€ ${formatPrice(event.highestBid)}` : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-sky-400">
              {event.bidCount > 0
                ? `${event.bidCount} ${event.bidCount !== 1 ? t('market.bidUnitPlural', lang) : t('market.bidUnitSingular', lang)}`
                : t('market.noBids', lang)}
            </p>
          </div>
        </div>

        {hasTickets && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100 text-xs">
            <span className="text-emerald-600">{t('market.buyFrom', lang)} {t('market.inclFees', lang)}</span>
            <span className="font-semibold text-emerald-700">
              € {formatPrice(calculateBuyerTotal(event.lowestAsk))}
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[10px]">
          <span className="text-slate-400">
            {hasTickets
              ? `${event.ticketCount} ${event.ticketCount !== 1 ? t('market.ticketUnitPlural', lang) : t('market.ticketUnitSingular', lang)} ${t('market.ticketsAvailable', lang)}`
              : t('market.noTickets', lang)}
          </span>
          <span className="font-medium uppercase tracking-[0.18em] text-slate-400">
            {t('market.viewOrderbook', lang)}
          </span>
        </div>
      </article>
    </Link>
  );
}
