'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { calculateBuyerTotal, formatPrice } from '@/lib/fees';

export default function MarktPage() {
  const [eventCards, setEventCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState('');
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
        .select('id, name, date, venue')
        .order('date', { ascending: true });

      if (eventsErr) throw eventsErr;

      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, event_id, ask_price, status')
        .eq('status', 'available')
        .not('ask_price', 'is', null);

      const ticketIds = (tickets ?? []).map((t) => t.id);

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
        if (!ticketMap[t.event_id]) ticketMap[t.event_id] = { askPrices: [], bidPrices: [], count: 0 };
        ticketMap[t.event_id].askPrices.push(Number(t.ask_price));
        ticketMap[t.event_id].count++;
        if (ticketBidMap[t.id] != null) {
          ticketMap[t.event_id].bidPrices.push(ticketBidMap[t.id]);
        }
      }

      const cards = (events ?? []).map((ev) => {
        const td = ticketMap[ev.id] || { askPrices: [], bidPrices: [], count: 0 };
        const allBids = [...td.bidPrices, ...(eventBidMap[ev.id] || [])];
        const lowestAsk = td.askPrices.length > 0 ? Math.min(...td.askPrices) : null;
        const highestBid = allBids.length > 0 ? Math.max(...allBids) : null;
        return {
          ...ev,
          lowestAsk,
          highestBid,
          ticketCount: td.count,
          bidCount: allBids.length,
        };
      });

      setEventCards(cards);
    } catch (err) {
      console.error('Error loading market:', err);
      setError('Er ging iets mis bij het ophalen van de marktdata.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = search.trim()
    ? eventCards.filter(
        (ev) =>
          ev.name?.toLowerCase().includes(search.toLowerCase()) ||
          ev.venue?.toLowerCase().includes(search.toLowerCase())
      )
    : eventCards;

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
        .select('id, name, date, venue')
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
            Markt voor live tickets
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Zoek naar events en bekijk het actuele bod en laat.
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
              placeholder="Zoek naar een artiest, festival of locatie..."
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {showNoResults && !showAddEvent && (
            <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
              <p className="mb-3 text-center text-xs text-slate-400">
                Geen events gevonden voor "{search}"
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewEventName(search.trim());
                  setShowAddEvent(true);
                }}
                className="w-full rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400"
              >
                + Event toevoegen
              </button>
            </div>
          )}

          {showAddEvent && (
            <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Nieuw event toevoegen
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Naam</label>
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder="Bijv. Awakenings Festival"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Datum</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Locatie</label>
                  <input
                    type="text"
                    value={newEventVenue}
                    onChange={(e) => setNewEventVenue(e.target.value)}
                    placeholder="Bijv. Spaarnwoude"
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
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  disabled={addingEvent || !newEventName.trim()}
                  className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400 disabled:opacity-60"
                >
                  {addingEvent ? 'Bezig...' : 'Event toevoegen'}
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && <p className="text-center text-slate-500">Laden...</p>}
        {error && <p className="text-center text-rose-600">{error}</p>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </section>

        {!loading && !search.trim() && eventCards.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Er zijn nog geen events. Voeg een event toe via de zoekbalk.
          </p>
        )}
      </main>
    </div>
  );
}

function EventCard({ event }) {
  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const hasTickets = event.ticketCount > 0;

  return (
    <Link href={`/markt/${event.id}`} className="block">
      <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">{event.name}</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {formattedDate && <span>{formattedDate}</span>}
            {formattedDate && event.venue && <span className="text-slate-300">·</span>}
            {event.venue && <span>{event.venue}</span>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-100">
            <p className="uppercase tracking-[0.18em] text-rose-600">Laat</p>
            <p className="mt-1 text-sm font-semibold text-rose-700">
              {event.lowestAsk != null ? `€ ${formatPrice(event.lowestAsk)}` : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-rose-400">
              {hasTickets ? 'laagste vraagprijs' : 'geen aanbod'}
            </p>
          </div>
          <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100">
            <p className="uppercase tracking-[0.18em] text-sky-600">Bod</p>
            <p className="mt-1 text-sm font-semibold text-sky-700">
              {event.highestBid != null ? `€ ${formatPrice(event.highestBid)}` : '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-sky-400">
              {event.bidCount > 0
                ? `${event.bidCount} bod${event.bidCount !== 1 ? 'en' : ''}`
                : 'geen biedingen'}
            </p>
          </div>
        </div>

        {hasTickets && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100 text-xs">
            <span className="text-emerald-600">Kopen vanaf incl. kosten</span>
            <span className="font-semibold text-emerald-700">
              € {formatPrice(calculateBuyerTotal(event.lowestAsk))}
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[10px]">
          <span className="text-slate-400">
            {hasTickets
              ? `${event.ticketCount} ticket${event.ticketCount !== 1 ? 's' : ''} beschikbaar`
              : 'Nog geen tickets'}
          </span>
          <span className="font-medium uppercase tracking-[0.18em] text-slate-400">
            Bekijk orderboek →
          </span>
        </div>
      </article>
    </Link>
  );
}
