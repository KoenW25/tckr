'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { calculateBuyerTotal, calculateServiceFee, formatPrice } from '@/lib/fees';
import { eventToSlug, slugifyEventName } from '@/lib/eventSlug';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function EventDetailPage() {
  const isValidOneEuroStep = (amount) => {
    const cents = Math.round(Number(amount) * 100);
    return Number.isFinite(cents) && cents % 100 === 0;
  };

  const { lang } = useLanguage();
  const { id: eventParam } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [event, setEvent] = useState(null);
  const [resolvedEventId, setResolvedEventId] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [bids, setBids] = useState([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [priceChartData, setPriceChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [bidAmount, setBidAmount] = useState('');
  const [directBuyQuantity, setDirectBuyQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyStatusLoading, setNotifyStatusLoading] = useState(false);
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [priceEditorOpen, setPriceEditorOpen] = useState(false);
  const [priceDraftByTicketId, setPriceDraftByTicketId] = useState({});
  const [savingPriceTicketId, setSavingPriceTicketId] = useState(null);
  const [priceEditorMessage, setPriceEditorMessage] = useState('');

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        setUser(authData?.user ?? null);

        const parsedEventId = Number(eventParam);
        const isNumericEventParam = Number.isInteger(parsedEventId) && parsedEventId > 0;
        let eventData = null;
        let eventErr = null;

        if (isNumericEventParam) {
          const { data, error } = await supabase
            .from('events')
            .select('id, name, date, venue, venue_name, city, country_code')
            .eq('id', parsedEventId)
            .maybeSingle();
          eventData = data;
          eventErr = error;
        } else {
          const { data, error } = await supabase
            .from('events')
            .select('id, name, date, venue, venue_name, city, country_code');
          eventErr = error;
          if (!error) {
            eventData = (data ?? []).find((candidate) => slugifyEventName(candidate?.name) === eventParam) || null;
          }
        }

        if (eventErr) throw eventErr;
        if (!eventData) {
          setError(t('event.notFound', lang));
          return;
        }
        setEvent(eventData);
        setResolvedEventId(Number(eventData.id));

        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('id, ask_price, status, user_id')
          .eq('event_id', eventData.id)
          .eq('status', 'available')
          .not('ask_price', 'is', null)
          .order('ask_price', { ascending: true });

        setTickets(ticketsData ?? []);

        const ticketIds = (ticketsData ?? []).map((tk) => tk.id);

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
          .eq('event_id', eventData.id)
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

        const txRes = await fetch(`/api/events/${eventData.id}/transactions`);
        if (txRes.ok) {
          const txJson = await txRes.json();
          const points = (txJson?.points ?? []).map((tx) => ({
            date: new Date(tx.soldAt).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'short',
            }),
            price: Number(tx.price),
          }));
          setPriceChartData(points);
          setTransactionCount(Number(txJson?.count ?? points.length));
        } else {
          setPriceChartData([]);
          setTransactionCount(0);
        }
      } catch (err) {
        console.error('Error loading event detail:', err);
        setError(t('event.loadError', lang));
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [eventParam]);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifyStatus() {
      if (!user?.id || !resolvedEventId) {
        if (isMounted) setNotifySubscribed(false);
        return;
      }

      setNotifyStatusLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (isMounted) setNotifySubscribed(false);
          return;
        }

        const response = await fetch(`/api/events/availability-subscriptions?eventId=${resolvedEventId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return;
        if (isMounted) setNotifySubscribed(Boolean(json?.subscribed));
      } catch (err) {
        console.error('Notify status error:', err);
      } finally {
        if (isMounted) setNotifyStatusLoading(false);
      }
    }

    loadNotifyStatus();
    return () => {
      isMounted = false;
    };
  }, [user?.id, resolvedEventId]);

  useEffect(() => {
    if (!event?.name) return;
    const canonicalSlug = eventToSlug(event);
    if (!canonicalSlug) return;
    if (eventParam !== canonicalSlug) {
      router.replace(`/markt/${canonicalSlug}`);
    }
  }, [event?.name, event?.id, eventParam, router]);

  const handleSubmitBid = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!resolvedEventId) {
      setBidError(t('event.loadError', lang));
      return;
    }

    if (isExpired) {
      setBidError(t('event.bidExpiredError', lang));
      setBidSuccess('');
      return;
    }

    const numeric = Number(
      String(bidAmount).replace(',', '.').replace(/[^0-9.]/g, '')
    );

    if (!Number.isFinite(numeric) || numeric <= 0) {
      setBidError(t('event.invalidAmount', lang));
      return;
    }
    if (!isValidOneEuroStep(numeric)) {
      setBidError(t('event.invalidStep', lang));
      return;
    }

    setSubmitting(true);
    setBidError('');
    setBidSuccess('');

    try {
      const { data, error: insertErr } = await supabase
        .from('bids')
        .insert({
          event_id: Number(resolvedEventId),
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
      setBidSuccess(`Je bod van € ${formatPrice(numeric)} ${t('event.bidPlaced', lang)}`);
      setBidAmount('');
    } catch (err) {
      console.error('Bid error:', err);
      setBidError(t('event.bidError', lang));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotifyOnAvailability = async () => {
    if (!user) {
      router.push(`/login?next=/markt/${eventParam}`);
      return;
    }
    if (!resolvedEventId) return;

    setNotifyLoading(true);
    setNotifyMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setNotifyMessage('Je sessie is verlopen. Log opnieuw in.');
        return;
      }

      const response = notifySubscribed
        ? await fetch('/api/events/availability-subscriptions', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ eventId: resolvedEventId }),
          })
        : await fetch('/api/events/subscribe-availability', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ eventId: resolvedEventId }),
          });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotifyMessage(json?.error || 'Aanmelden voor melding mislukt.');
        return;
      }

      if (notifySubscribed) {
        setNotifySubscribed(false);
        setNotifyMessage('Je bent afgemeld voor deze ticket alert.');
      } else {
        setNotifySubscribed(true);
        setNotifyMessage('Je krijgt een mail zodra er een ticket beschikbaar is.');
      }
    } catch (err) {
      console.error('Notify subscribe error:', err);
      setNotifyMessage(notifySubscribed ? 'Afmelden voor melding mislukt.' : 'Aanmelden voor melding mislukt.');
    } finally {
      setNotifyLoading(false);
    }
  };

  const parsePriceInput = (value) => {
    const normalized = String(value ?? '')
      .trim()
      .replace(',', '.')
      .replace(/[^0-9.]/g, '');
    return Number(normalized);
  };

  const handleOpenPriceEditor = () => {
    const ownTickets = tickets.filter((ticket) => ticket.user_id === user?.id);
    const nextDrafts = {};
    for (const ticket of ownTickets) {
      nextDrafts[ticket.id] = Number(ticket.ask_price).toFixed(2).replace('.', ',');
    }
    setPriceDraftByTicketId(nextDrafts);
    setPriceEditorMessage('');
    setPriceEditorOpen((prev) => !prev);
  };

  const handleSaveTicketPrice = async (ticketId) => {
    if (!user?.id) {
      router.push(`/login?next=/markt/${eventParam}`);
      return;
    }

    const numericPrice = parsePriceInput(priceDraftByTicketId[ticketId]);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setPriceEditorMessage('Voer een geldige prijs in.');
      return;
    }
    if (!isValidOneEuroStep(numericPrice)) {
      setPriceEditorMessage('Prijs moet in stappen van €1,00.');
      return;
    }

    setSavingPriceTicketId(ticketId);
    setPriceEditorMessage('');
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update({ ask_price: numericPrice })
        .eq('id', ticketId)
        .eq('user_id', user.id)
        .eq('status', 'available')
        .select('id, ask_price, user_id, status')
        .single();

      if (error || !data) {
        setPriceEditorMessage('Prijs aanpassen mislukt.');
        return;
      }

      setTickets((prev) =>
        prev
          .map((ticket) => (ticket.id === data.id ? { ...ticket, ask_price: data.ask_price } : ticket))
          .sort((a, b) => Number(a.ask_price) - Number(b.ask_price))
      );
      setPriceDraftByTicketId((prev) => ({
        ...prev,
        [ticketId]: Number(data.ask_price).toFixed(2).replace('.', ','),
      }));
      setPriceEditorMessage('Prijs aangepast.');
    } catch (err) {
      console.error('Event page ticket price update failed:', err);
      setPriceEditorMessage('Prijs aanpassen mislukt.');
    } finally {
      setSavingPriceTicketId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">{t('event.loading', lang)}</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            {error || t('event.notFound', lang)}
          </div>
          <Link href="/markt" className="mt-4 inline-block text-xs text-sky-600 hover:underline">
            {t('event.backToMarket', lang)}
          </Link>
        </div>
      </div>
    );
  }

  const askPrices = tickets.map((tk) => Number(tk.ask_price));
  const lowestAsk = askPrices.length > 0 ? Math.min(...askPrices) : null;
  const ownAvailableTickets = tickets.filter((ticket) => ticket.user_id === user?.id);
  const purchasableTickets = tickets
    .filter((ticket) => !user?.id || ticket.user_id !== user.id)
    .sort((a, b) => Number(a.ask_price) - Number(b.ask_price));
  const maxDirectBuyTickets = purchasableTickets.length;
  const safeDirectBuyQuantity = Math.max(1, Math.min(directBuyQuantity, maxDirectBuyTickets || 1));
  const selectedDirectBuyTickets = purchasableTickets.slice(0, safeDirectBuyQuantity);
  const directBuyTicketSubtotal = selectedDirectBuyTickets.reduce(
    (sum, ticket) => sum + Number(ticket.ask_price || 0),
    0
  );
  const directBuyFeeTotal = selectedDirectBuyTickets.reduce(
    (sum, ticket) => sum + calculateServiceFee(ticket.ask_price),
    0
  );
  const directBuyTotal = selectedDirectBuyTickets.reduce(
    (sum, ticket) => sum + calculateBuyerTotal(ticket.ask_price),
    0
  );
  const directBuyCheckoutHref =
    selectedDirectBuyTickets.length === 0
      ? null
      : selectedDirectBuyTickets.length === 1
        ? `/checkout/${selectedDirectBuyTickets[0].id}`
        : `/checkout/${selectedDirectBuyTickets[0].id}?ticketIds=${selectedDirectBuyTickets.map((ticket) => ticket.id).join(',')}`;
  const highestBid = bids.length > 0 ? Number(bids[0].bid_price) : null;
  const spread = lowestAsk != null && highestBid != null ? lowestAsk - highestBid : null;
  const groupedBids = Object.values(
    bids.reduce((acc, bid) => {
      const bidPrice = Number(bid.bid_price);
      if (!Number.isFinite(bidPrice)) return acc;
      const key = bidPrice.toFixed(2);
      if (!acc[key]) {
        acc[key] = { bidPrice, count: 0 };
      }
      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.bidPrice - a.bidPrice);
  const maxGroupedBidCount = groupedBids.length > 0
    ? Math.max(...groupedBids.map((entry) => entry.count))
    : 0;
  const groupedAsks = Object.values(
    tickets.reduce((acc, ticket) => {
      const askPrice = Number(ticket.ask_price);
      if (!Number.isFinite(askPrice)) return acc;
      const key = askPrice.toFixed(2);
      if (!acc[key]) {
        acc[key] = { askPrice, count: 0 };
      }
      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => a.askPrice - b.askPrice);

  const isExpired = event.date && new Date(event.date) < new Date(new Date().toDateString());

  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const locationText = [event.city, event.venue_name || event.venue, event.country_code]
    .filter(Boolean)
    .join(' - ');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/markt"
          className="mb-6 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          {t('event.backToMarket', lang)}
        </Link>

        <header className="mb-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h1 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${isExpired ? 'text-slate-400' : 'text-slate-900'}`}>
                {event.name}
              </h1>
              {isExpired && (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  {t('event.expired', lang)}
                </span>
              )}
            </div>
            {!isExpired && (
              <div className="flex flex-wrap items-center gap-2">
                {lowestAsk == null && (
                  <button
                    type="button"
                    onClick={handleNotifyOnAvailability}
                    disabled={notifyLoading || notifyStatusLoading}
                    className="rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:opacity-60"
                  >
                    {notifyLoading
                      ? 'Bezig...'
                      : notifyStatusLoading
                        ? 'Even laden...'
                        : notifySubscribed
                          ? 'Uitschrijven alert'
                          : 'Mail bij aanbod'}
                  </button>
                )}
                <Link
                  href={resolvedEventId ? `/upload?eventId=${resolvedEventId}` : '/upload'}
                  className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400"
                >
                  {t('nav.sell', lang)}
                </Link>
                {ownAvailableTickets.length > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenPriceEditor}
                    className="rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                  >
                    {t('event.updatePrice', lang)}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            {formattedDate && <span>{formattedDate}</span>}
            {formattedDate && locationText && <span className="text-slate-300">·</span>}
            {locationText && <span>{locationText}</span>}
          </div>
          {notifyMessage && lowestAsk == null && (
            <p className="mt-2 text-xs text-slate-500">{notifyMessage}</p>
          )}
          {priceEditorMessage && (
            <p
              className={`mt-2 text-xs ${
                priceEditorMessage.toLowerCase().includes('mislukt') || priceEditorMessage.toLowerCase().includes('geldige')
                  ? 'text-rose-600'
                  : 'text-emerald-600'
              }`}
            >
              {priceEditorMessage}
            </p>
          )}
        </header>

        {priceEditorOpen && ownAvailableTickets.length > 0 && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{t('event.yourListedTickets', lang)}</h2>
            <div className="space-y-2">
              {ownAvailableTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-xs text-slate-500">
                    Ticket #{ticket.id} · {t('event.currentPrice', lang)}: € {formatPrice(ticket.ask_price)}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[11px] text-slate-400">
                        €
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={priceDraftByTicketId[ticket.id] ?? ''}
                        onChange={(e) =>
                          setPriceDraftByTicketId((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        className="w-full rounded-full border border-slate-200 bg-white py-1.5 pl-5 pr-2 text-xs text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveTicketPrice(ticket.id)}
                      disabled={savingPriceTicketId === ticket.id}
                      className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {savingPriceTicketId === ticket.id ? t('event.saving', lang) : t('event.save', lang)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Spread overview */}
        <section className="mb-8 grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-rose-500">
              <span>{t('event.ask', lang)}</span>{' '}
              <span className="text-[9px] normal-case tracking-normal text-rose-400">
                ({t('event.askDetail', lang)})
              </span>
            </p>
            <p className="mt-1 text-xl font-bold text-rose-700">
              {lowestAsk != null ? `€ ${formatPrice(lowestAsk)}` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-500">
              <span>{t('event.bid', lang)}</span>{' '}
              <span className="text-[9px] normal-case tracking-normal text-sky-400">
                ({t('event.bidDetail', lang)})
              </span>
            </p>
            <p className="mt-1 text-xl font-bold text-sky-700">
              {highestBid != null ? `€ ${formatPrice(highestBid)}` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              {t('event.spread', lang)}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-700">
              {spread != null ? `€ ${formatPrice(spread)}` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-500">
              {t('event.transactions', lang)}
            </p>
            <p className="mt-1 text-xl font-bold text-violet-700">
              {transactionCount}
            </p>
          </div>
        </section>

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {/* Direct kopen */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">{t('event.buyNow', lang)}</h3>
            {selectedDirectBuyTickets.length > 0 ? (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  {t('event.buyNowDesc', lang)}
                </p>
                {maxDirectBuyTickets > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label htmlFor="direct-buy-quantity" className="text-xs text-slate-600">
                      {t('event.ticketCount', lang)}
                    </label>
                    <select
                      id="direct-buy-quantity"
                      value={safeDirectBuyQuantity}
                      onChange={(e) => setDirectBuyQuantity(Number(e.target.value))}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    >
                      {Array.from({ length: maxDirectBuyTickets }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>{t('event.ticketPriceTotal', lang)}</span>
                    <span className="font-medium text-slate-900">€ {formatPrice(directBuyTicketSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('event.serviceFeesTotal', lang)}</span>
                    <span className="font-medium text-slate-900">€ {formatPrice(directBuyFeeTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1">
                    <span className="font-semibold text-slate-900">{t('event.total', lang)}</span>
                    <span className="font-semibold text-emerald-700">€ {formatPrice(directBuyTotal)}</span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {t('event.availableTicketsForYou', lang)}: {maxDirectBuyTickets} · {t('event.selectedAsks', lang)}
                </p>
                {directBuyCheckoutHref && (
                  <Link
                    href={directBuyCheckoutHref}
                    className="mt-4 block w-full rounded-full bg-emerald-500 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400"
                  >
                    {t('event.buyFor', lang)} € {formatPrice(directBuyTotal)}
                  </Link>
                )}
              </>
            ) : tickets.length > 0 && user?.id ? (
              <>
                <p className="mt-3 text-xs text-slate-500">
                  {t('event.onlyOwnTickets', lang)}
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 block w-full cursor-not-allowed rounded-full bg-slate-200 px-4 py-2.5 text-center text-xs font-semibold text-slate-500"
                >
                  {t('event.ownTicket', lang)}
                </button>
              </>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                {t('event.noTicketsYet', lang)}
              </p>
            )}
          </div>

          {/* Bod plaatsen */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">{t('event.placeBid', lang)}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {isExpired ? t('event.bidExpiredError', lang) : t('event.placeBidDesc', lang)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {t('event.tickSizeHint', lang)}
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
                placeholder={t('event.bidPlaceholder', lang)}
                disabled={isExpired}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>

            {bidError && <p className="mt-2 text-xs text-rose-600">{bidError}</p>}
            {bidSuccess && <p className="mt-2 text-xs text-emerald-600">{bidSuccess}</p>}

            <button
              type="button"
              onClick={handleSubmitBid}
              disabled={submitting || isExpired}
              className="mt-3 w-full rounded-full bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400 disabled:opacity-60"
            >
              {submitting ? t('event.submitting', lang) : t('event.placeBid', lang)}
            </button>
          </div>

          {/* Orderboek */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{t('event.orderbook', lang)}</h2>
              {spread != null && (
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  {t('event.spread', lang)}: € {formatPrice(spread)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-100">
              {/* BID zijde (links) */}
              <div>
                <div className="grid grid-cols-2 border-b border-slate-100 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  <span>{t('event.bidLabel', lang)}</span>
                  <span className="text-right">{t('event.volume', lang)}</span>
                </div>
                {groupedBids.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    {t('event.noBids', lang)}
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {groupedBids.map((entry) => {
                      const depthPct = maxGroupedBidCount > 0
                        ? Math.round((entry.count / maxGroupedBidCount) * 100)
                        : 50;
                      return (
                        <div key={entry.bidPrice} className="relative">
                          <div
                            className="absolute inset-y-0 right-0 bg-emerald-50"
                            style={{ width: `${Math.min(depthPct, 100)}%` }}
                          />
                          <div className="relative grid grid-cols-2 px-4 py-1.5 text-xs">
                            <span className="font-semibold text-emerald-700">
                              € {formatPrice(entry.bidPrice)}
                            </span>
                            <span className="text-right text-emerald-600">
                              {entry.count}x
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
                  <span>{t('event.askLabel', lang)}</span>
                  <span className="text-right">{t('event.volume', lang)}</span>
                </div>
                {groupedAsks.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    {t('event.noSupply', lang)}
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {groupedAsks.map((entry) => (
                      <div key={entry.askPrice} className="relative">
                        <div className="absolute inset-y-0 left-0 bg-rose-50" style={{ width: '100%' }} />
                        <div className="relative grid grid-cols-2 px-4 py-1.5 text-xs">
                          <span className="font-semibold text-rose-700">
                            € {formatPrice(entry.askPrice)}
                          </span>
                          <span className="text-right text-rose-600">
                            {entry.count}x
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-4 py-2 text-center text-[10px] text-slate-400">
                  {tickets.length} {t('event.offersAvailable', lang)}
                </div>
              </div>
            </div>
          </section>

          {/* Prijsverloop grafiek */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{t('event.priceHistory', lang)}</h2>
            </div>
            <div className="p-5">
              {priceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={priceChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} width={50} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
                      formatter={(value) => [`€ ${formatPrice(value)}`, t('event.price', lang)]}
                    />
                    <Area type="monotone" dataKey="price" stroke="#0ea5e9" strokeWidth={2} fill="url(#priceGradient)" dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  {t('event.noPriceData', lang)}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
