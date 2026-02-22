'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickerEvents, setTickerEvents] = useState([]);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error) {
          setUser(data.user ?? null);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchTickerData() {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, name')
        .order('date', { ascending: true });

      if (error || !events || events.length === 0) return;

      const { data: tickets } = await supabase
        .from('tickets')
        .select('event_id, ask_price')
        .eq('status', 'available')
        .not('ask_price', 'is', null);

      const priceMap = {};
      for (const t of tickets ?? []) {
        if (!t.event_id) continue;
        if (!priceMap[t.event_id]) priceMap[t.event_id] = [];
        priceMap[t.event_id].push(Number(t.ask_price));
      }

      const eventIds = events.map((e) => e.id);
      const { data: bidsData } = await supabase
        .from('bids')
        .select('event_id, bid_price')
        .in('event_id', eventIds)
        .eq('status', 'pending');

      const bidMap = {};
      for (const b of bidsData ?? []) {
        if (!b.event_id) continue;
        if (!bidMap[b.event_id] || b.bid_price > bidMap[b.event_id]) {
          bidMap[b.event_id] = Number(b.bid_price);
        }
      }

      const enriched = events.map((ev) => {
        const prices = priceMap[ev.id] || [];
        const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
        const highestBid = bidMap[ev.id] ?? null;
        return {
          id: ev.id,
          name: ev.name,
          price: lowestPrice,
          highestBid,
          ticketCount: prices.length,
        };
      });

      setTickerEvents(enriched);
    }

    fetchTickerData();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push('/');
    }
  };

  const displayName =
    user?.user_metadata?.full_name?.split?.(' ')?.[0] || user?.email || '';

  return (
    <>
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight hover:opacity-80"
          >
            <span className="text-xl">🎟</span>
            <span>Tickr</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <Link
              href="/hoe-het-werkt"
              className="hidden rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-600 hover:border-slate-300 hover:bg-slate-50 sm:inline-block"
            >
              Hoe het werkt
            </Link>

            {!loading && !user && (
              <Link
                href="/login"
                className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400"
              >
                Login
              </Link>
            )}

            {!loading && user && (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="hidden rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 hover:border-slate-300 hover:bg-slate-50 sm:inline-block"
                >
                  Mijn dashboard
                </Link>
                <Link
                  href="/upload"
                  className="hidden rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400 sm:inline-block"
                >
                  Ticket verkopen
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-slate-900/30 transition hover:bg-slate-800"
                >
                  Uitloggen
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Ticker regel */}
      {tickerEvents.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-900 text-xs text-emerald-300">
          <div className="relative mx-auto max-w-6xl overflow-hidden px-4">
            <div className="ticker-track flex gap-12 py-2">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-center gap-10 whitespace-nowrap">
                  {tickerEvents.map((event) => (
                    <Link
                      key={`${copy}-${event.id}`}
                      href={`/markt/${event.id}`}
                      className="flex items-baseline gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span className="text-slate-200 tracking-[0.18em] text-[11px]">
                        {event.name.toUpperCase()}
                      </span>
                      {event.price != null ? (
                        <>
                          <span className="font-semibold text-emerald-300">
                            €{event.price}
                          </span>
                          <span className="text-[11px] text-emerald-400">
                            {event.ticketCount} ticket{event.ticketCount !== 1 ? 's' : ''}
                          </span>
                        </>
                      ) : event.highestBid != null ? (
                        <span className="font-semibold text-sky-300">
                          Bod €{event.highestBid}
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-500">—</span>
                      )}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </>
  );
}

