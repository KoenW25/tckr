'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { calculateBuyerTotal, calculateServiceFee, formatPrice } from '@/lib/fees';

export default function EventDetailPage() {
  const { id: eventId } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        setUser(authData?.user ?? null);

        const { data: eventData, error: eventErr } = await supabase
          .from('events')
          .select('id, name, date, venue')
          .eq('id', eventId)
          .single();

        if (eventErr) throw eventErr;
        if (!eventData) {
          setError('Event niet gevonden.');
          return;
        }
        setEvent(eventData);

        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('id, ask_price, status')
          .eq('event_id', eventId)
          .eq('status', 'available')
          .not('ask_price', 'is', null)
          .order('ask_price', { ascending: true });

        setTickets(ticketsData ?? []);

        const ticketIds = (ticketsData ?? []).map((t) => t.id);

        let allBids = [];

        if (ticketIds.length > 0) {
          const { data: ticketBids } = await supabase
            .from('bids')
            .select('id, bid_price, created_at, status, ticket_id, event_id')
            .in('ticket_id', ticketIds)
            .eq('status', 'pending')
            .order('bid_price', { ascending: false });

          allBids = [...allBids, ...(ticketBids ?? [])];
        }

        const { data: eventBids } = await supabase
          .from('bids')
          .select('id, bid_price, created_at, status, ticket_id, event_id')
          .eq('event_id', eventId)
          .is('ticket_id', null)
          .eq('status', 'pending')
          .order('bid_price', { ascending: false });

        allBids = [...allBids, ...(eventBids ?? [])];

        allBids.sort((a, b) => b.bid_price - a.bid_price);

        const seen = new Set();
        const unique = allBids.filter((b) => {
          if (seen.has(b.id)) return false;
          seen.add(b.id);
          return true;
        });

        setBids(unique);
      } catch (err) {
        console.error('Error loading event detail:', err);
        setError('Er ging iets mis bij het laden van dit event.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [eventId]);

  const handleSubmitBid = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    const numeric = Number(
      String(bidAmount).replace(',', '.').replace(/[^0-9.]/g, '')
    );

    if (!Number.isFinite(numeric) || numeric <= 0) {
      setBidError('Vul een geldig bedrag in.');
      return;
    }

    setSubmitting(true);
    setBidError('');
    setBidSuccess('');

    try {
      const { data, error: insertErr } = await supabase
        .from('bids')
        .insert({
          event_id: Number(eventId),
          ticket_id: null,
          user_id: user.id,
          bid_price: numeric,
          status: 'pending',
        })
        .select('id, bid_price, created_at, status, ticket_id, event_id')
        .single();

      if (insertErr) throw insertErr;

      setBids((prev) =>
        [data, ...prev].sort((a, b) => b.bid_price - a.bid_price)
      );
      setBidSuccess(`Je bod van € ${formatPrice(numeric)} is geplaatst!`);
      setBidAmount('');
    } catch (err) {
      console.error('Bid error:', err);
      setBidError('Er ging iets mis bij het plaatsen van je bod.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Bezig met laden...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            {error || 'Event niet gevonden.'}
          </div>
          <Link href="/markt" className="mt-4 inline-block text-xs text-sky-600 hover:underline">
            Terug naar de markt
          </Link>
        </div>
      </div>
    );
  }

  const askPrices = tickets.map((t) => Number(t.ask_price));
  const lowestAsk = askPrices.length > 0 ? Math.min(...askPrices) : null;
  const cheapestTicket = tickets.find((t) => Number(t.ask_price) === lowestAsk);
  const highestBid = bids.length > 0 ? Number(bids[0].bid_price) : null;
  const spread = lowestAsk != null && highestBid != null ? lowestAsk - highestBid : null;

  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/markt"
          className="mb-6 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          ← Terug naar de markt
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {event.name}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            {formattedDate && <span>{formattedDate}</span>}
            {formattedDate && event.venue && <span className="text-slate-300">·</span>}
            {event.venue && <span>{event.venue}</span>}
          </div>
        </header>

        {/* Spread overview */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-rose-500">
              Laat (vraagprijs)
            </p>
            <p className="mt-1 text-xl font-bold text-rose-700">
              {lowestAsk != null ? `€ ${formatPrice(lowestAsk)}` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-500">
              Bod (hoogste)
            </p>
            <p className="mt-1 text-xl font-bold text-sky-700">
              {highestBid != null ? `€ ${formatPrice(highestBid)}` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Spread
            </p>
            <p className="mt-1 text-xl font-bold text-slate-700">
              {spread != null ? `€ ${formatPrice(spread)}` : '—'}
            </p>
          </div>
        </section>

        {/* Orderboek */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Orderboek</h2>
            {spread != null && (
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Spread: € {formatPrice(spread)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-100">
            {/* BID zijde (links) */}
            <div>
              <div className="grid grid-cols-2 border-b border-slate-100 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                <span>Tijd</span>
                <span className="text-right">Bod (BID)</span>
              </div>
              {bids.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Nog geen biedingen
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {bids.map((bid) => {
                    const depthPct = lowestAsk && lowestAsk > 0
                      ? Math.round((Number(bid.bid_price) / lowestAsk) * 100)
                      : 50;
                    return (
                      <div key={bid.id} className="relative">
                        <div
                          className="absolute inset-y-0 right-0 bg-emerald-50"
                          style={{ width: `${Math.min(depthPct, 100)}%` }}
                        />
                        <div className="relative grid grid-cols-2 px-4 py-1.5 text-xs">
                          <span className="text-slate-400">
                            {new Date(bid.created_at).toLocaleTimeString('nl-NL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-right font-semibold text-emerald-700">
                            € {formatPrice(bid.bid_price)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ASK zijde (rechts) */}
            <div>
              <div className="grid grid-cols-2 border-b border-slate-100 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                <span>Laat (ASK)</span>
                <span className="text-right">Incl. kosten</span>
              </div>
              {tickets.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Nog geen aanbod
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {tickets.map((t) => (
                    <div key={t.id} className="relative">
                      <div className="absolute inset-y-0 left-0 bg-rose-50" style={{ width: '100%' }} />
                      <div className="relative grid grid-cols-2 px-4 py-1.5 text-xs">
                        <span className="font-semibold text-rose-700">
                          € {formatPrice(t.ask_price)}
                        </span>
                        <span className="text-right text-rose-500">
                          € {formatPrice(calculateBuyerTotal(Number(t.ask_price)))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-4 py-2 text-center text-[10px] text-slate-400">
                {tickets.length} aanbieding{tickets.length !== 1 ? 'en' : ''} beschikbaar
              </div>
            </div>
          </div>
        </section>

        {/* Acties */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Direct kopen */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Direct kopen</h3>
            {lowestAsk != null && cheapestTicket ? (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  Koop voor de laagste vraagprijs — direct afgehandeld.
                </p>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Ticketprijs</span>
                    <span className="font-medium text-slate-900">€ {formatPrice(lowestAsk)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Servicekosten</span>
                    <span className="font-medium text-slate-900">€ {formatPrice(calculateServiceFee(lowestAsk))}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1">
                    <span className="font-semibold text-slate-900">Totaal</span>
                    <span className="font-semibold text-emerald-700">€ {formatPrice(calculateBuyerTotal(lowestAsk))}</span>
                  </div>
                </div>
                <Link
                  href={`/checkout/${cheapestTicket.id}`}
                  className="mt-4 block w-full rounded-full bg-emerald-500 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400"
                >
                  Kopen voor € {formatPrice(calculateBuyerTotal(lowestAsk))}
                </Link>
              </>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Er zijn nog geen tickets te koop voor dit event. Plaats een bod om je interesse te tonen.
              </p>
            )}
          </div>

          {/* Bod plaatsen */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Bod plaatsen</h3>
            <p className="mt-1 text-xs text-slate-500">
              Plaats een anoniem bod op dit event. Verkopers zien jouw bod en beslissen of ze het accepteren.
            </p>
            <div className="relative mt-3">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-slate-400">
                €
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="Bijv. 50"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>

            {bidError && <p className="mt-2 text-xs text-rose-600">{bidError}</p>}
            {bidSuccess && <p className="mt-2 text-xs text-emerald-600">{bidSuccess}</p>}

            <button
              type="button"
              onClick={handleSubmitBid}
              disabled={submitting}
              className="mt-3 w-full rounded-full bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400 disabled:opacity-60"
            >
              {submitting ? 'Bezig...' : 'Bod plaatsen'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
