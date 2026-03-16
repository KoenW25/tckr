'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';
import { eventToSlug } from '@/lib/eventSlug';

export default function Navbar() {
  const tickerDuration = '35s';
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickerEvents, setTickerEvents] = useState([]);
  const [searchEvents, setSearchEvents] = useState([]);
  const [headerSearch, setHeaderSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tickerPaused, setTickerPaused] = useState(false);
  const tickerPausedRef = useRef(false);
  const router = useRouter();
  const { lang, setLang } = useLanguage();

  useEffect(() => {
    tickerPausedRef.current = tickerPaused;
  }, [tickerPaused]);

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
        .select('id, name, date')
        .order('date', { ascending: true });

      if (error || !events || events.length === 0) return;

      const today = new Date(new Date().toDateString());
      const isNotExpired = (value) => {
        if (!value) return true;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return true;
        return parsed >= today;
      };
      const tickerSourceEvents = events.filter((ev) => isNotExpired(ev?.date));

      const { data: tickets } = await supabase
        .from('tickets')
        .select('event_id, ask_price')
        .eq('status', 'available')
        .not('ask_price', 'is', null);

      const priceMap = {};
      for (const ticket of tickets ?? []) {
        if (!ticket.event_id) continue;
        if (!priceMap[ticket.event_id]) priceMap[ticket.event_id] = [];
        priceMap[ticket.event_id].push(Number(ticket.ask_price));
      }

      const eventIds = tickerSourceEvents.map((e) => e.id);
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

      const enriched = tickerSourceEvents.map((ev) => {
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

      if (!tickerPausedRef.current) {
        setTickerEvents(enriched);
      }
      setSearchEvents((events ?? []).map(({ id, name }) => ({ id, name })));
    }

    fetchTickerData();
    const interval = setInterval(fetchTickerData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const quickLinks = useMemo(() => {
    const links = [{ id: 'markt', label: t('nav.market', lang), href: '/markt', type: 'page' }];

    if (!loading && user) {
      links.push(
        { id: 'verkopen', label: t('nav.sell', lang), href: '/upload', type: 'page' },
        { id: 'dashboard', label: t('nav.dashboard', lang), href: '/dashboard', type: 'page' },
        { id: 'logout', label: t('nav.logout', lang), href: '#logout', type: 'action' }
      );
    }

    if (!loading && !user) {
      links.push({ id: 'login', label: t('nav.login', lang), href: '/login', type: 'page' });
    }

    return links;
  }, [lang, loading, user]);

  const normalize = (value) => String(value || '').trim().toLowerCase();

  const searchItems = useMemo(() => {
    const q = normalize(headerSearch);
    if (!q) return [];

    const eventMatches = searchEvents
      .filter((ev) => normalize(ev?.name).includes(q))
      .slice(0, 5)
      .map((ev) => ({
        id: `event-${ev.id}`,
        label: String(ev?.name || 'Onbekend event'),
        href: `/markt/${eventToSlug(ev)}`,
        type: 'event',
      }));

    const quickMatches = quickLinks
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 5)
      .map((item) => ({
        id: `quick-${item.id}`,
        label: item.label,
        href: item.href,
        type: item.type,
      }));

    const hasExactEvent = searchEvents.some(
      (ev) => normalize(ev?.name) === q
    );
    const addEventItem =
      !hasExactEvent && headerSearch.trim().length >= 2
        ? [
            {
              id: 'add-event',
              label: `Event "${headerSearch.trim()}" toevoegen`,
              href: `/upload?openAddEvent=true&createEvent=${encodeURIComponent(headerSearch.trim())}`,
              type: 'add-event',
            },
          ]
        : [];

    const combined = [...quickMatches, ...eventMatches];
    if (addEventItem.length > 0) {
      return [...addEventItem, ...combined].slice(0, 8);
    }
    return combined.slice(0, 8);
  }, [headerSearch, searchEvents, quickLinks]);

  const handleSearchItemClick = (item) => {
    setSearchOpen(false);
    setHeaderSearch('');
    if (item.type === 'action' && item.href === '#logout') {
      handleLogout();
      return;
    }
    router.push(item.href);
  };

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight hover:opacity-80"
            >
              <span className="text-xl">🎟</span>
              <span>Tckr</span>
            </Link>

            <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2 sm:gap-3">
              <div className="relative w-24 shrink-0 sm:w-36 lg:w-44 xl:w-56">
                <input
                  type="text"
                  value={headerSearch}
                  onChange={(e) => {
                    setHeaderSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder={t('nav.searchPlaceholder', lang)}
                  className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
                {searchOpen && headerSearch.trim() && (
                  <div className="absolute right-0 z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:w-80">
                    {searchItems.length > 0 ? (
                      searchItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSearchItemClick(item)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span className="text-slate-800">{String(item.label || '')}</span>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                            {item.type === 'event' ? t('home.event', lang) : item.type === 'add-event' ? t('nav.new', lang) : t('nav.page', lang)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-400">{t('nav.searchNoResults', lang)}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden items-center gap-4 lg:flex">
                <Link
                  href="/markt"
                  className="text-sm text-slate-700 transition hover:text-slate-900"
                >
                  {t('nav.market', lang)}
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm text-slate-700 transition hover:text-slate-900"
                >
                  {t('nav.dashboard', lang)}
                </Link>
                <Link
                  href="/upload"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-800 transition hover:bg-slate-50"
                >
                  {t('nav.sell', lang)}
                </Link>
                {!loading && user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl bg-slate-900 px-4 py-1.5 text-sm text-white transition hover:bg-slate-800"
                  >
                    {t('nav.logout', lang)}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-xl bg-slate-900 px-4 py-1.5 text-sm text-white transition hover:bg-slate-800"
                  >
                    {t('nav.login', lang)}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                {lang === 'nl' ? '🇬🇧' : '🇳🇱'}
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition lg:hidden"
              >
                {t('nav.menu', lang)}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:hidden">
              <Link href="/markt" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-700">
                {t('nav.market', lang)}
              </Link>
              <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-700">
                {t('nav.dashboard', lang)}
              </Link>
              <Link href="/upload" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-700">
                {t('nav.sell', lang)}
              </Link>
              {!loading && user ? (
                <>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-center text-xs text-white"
                  >
                    {t('nav.logout', lang)}
                  </button>
                </>
              ) : (
                <Link href="/login" className="rounded-xl bg-slate-900 px-3 py-2 text-center text-xs text-white">
                  {t('nav.login', lang)}
                </Link>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Ticker regel */}
      {tickerEvents.length > 0 && (
        <div className="border-b border-slate-200 text-[10px] text-slate-700" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <div
            className="ticker-hover-zone relative mx-auto max-w-6xl overflow-hidden px-4"
            onMouseEnter={() => setTickerPaused(true)}
            onMouseMove={() => setTickerPaused(true)}
            onMouseLeave={() => setTickerPaused(false)}
            onPointerEnter={() => setTickerPaused(true)}
            onPointerMove={() => setTickerPaused(true)}
            onPointerLeave={() => setTickerPaused(false)}
            onFocusCapture={() => setTickerPaused(true)}
            onBlurCapture={() => setTickerPaused(false)}
            onTouchStart={() => setTickerPaused(true)}
            onTouchEnd={() => setTickerPaused(false)}
          >
            <div
            className="ticker-track flex gap-10 py-1.5"
              style={{
                animationDuration: tickerDuration,
                animationPlayState: tickerPaused ? 'paused' : 'running',
              }}
            >
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-center gap-10 whitespace-nowrap">
                  {tickerEvents.map((event) => (
                    <Link
                      key={`${copy}-${event.id}`}
                      href={`/markt/${eventToSlug(event)}`}
                    className="flex items-baseline gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span className="tracking-[0.2em] text-[10px] text-slate-800">
                        {String(event?.name || t('nav.unknownEvent', lang)).toUpperCase()}
                      </span>
                      <span className="text-slate-700">
                        {t('nav.offer', lang).toUpperCase()} {event.price != null ? `€${event.price}` : '—'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {event.ticketCount} {event.ticketCount !== 1 ? t('nav.ticketsPlural', lang) : t('nav.tickets', lang)}
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-700">
                        {t('nav.bid', lang).toUpperCase()} {event.highestBid != null ? `€${event.highestBid}` : '—'}
                      </span>
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

