'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';
import supabase from '@/lib/supabase';
import { calculateServiceFee, calculateBuyerTotal, formatPrice } from '@/lib/fees';

export default function CheckoutPage() {
  const { lang } = useLanguage();
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const [user, setUser] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [acceptedBid, setAcceptedBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const params = new URLSearchParams(queryString);
        const ticketIdsFromQuery = (params.get('ticketIds') || '')
          .split(',')
          .map((value) => Number(String(value).trim()))
          .filter((value) => Number.isInteger(value) && value > 0);
        const dedupedTicketIds = [...new Set(ticketIdsFromQuery)];
        const requestedTicketIds =
          dedupedTicketIds.length > 0
            ? dedupedTicketIds
            : Number.isInteger(Number(id)) && Number(id) > 0
              ? [Number(id)]
              : [];

        if (!session?.user) {
          const nextPath = `/checkout/${id}${queryString ? `?${queryString}` : ''}`;
          router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
          return;
        }
        const authUser = session.user;
        setUser(authUser);

        if (requestedTicketIds.length === 0) {
          setError(t('checkout.notFound', lang));
          return;
        }

        if (requestedTicketIds.length > 1) {
          const { data: ticketsData, error: ticketsError } = await supabase
            .from('tickets')
            .select('id, pdf_url, ask_price, status, user_id, event_name, event_date, reserved_for, reserved_until')
            .in('id', requestedTicketIds);

          if (ticketsError) throw ticketsError;

          const ticketsById = new Map((ticketsData ?? []).map((row) => [Number(row.id), row]));
          const orderedTickets = requestedTicketIds.map((ticketId) => ticketsById.get(ticketId)).filter(Boolean);

          if (orderedTickets.length !== requestedTicketIds.length) {
            setError(t('checkout.notFound', lang));
            return;
          }

          const unavailableTicket = orderedTickets.find((row) => row.status !== 'available');
          if (unavailableTicket) {
            setError(t('checkout.unavailable', lang));
            return;
          }

          const ownTicket = orderedTickets.find((row) => row.user_id === authUser.id);
          if (ownTicket) {
            setError(t('checkout.unavailable', lang));
            return;
          }

          setSelectedTickets(orderedTickets);
          setTicket(orderedTickets[0]);
          setAcceptedBid(null);
          return;
        }

        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('id, pdf_url, ask_price, status, user_id, event_name, event_date, reserved_for, reserved_until')
          .eq('id', requestedTicketIds[0])
          .single();

        if (ticketError) throw ticketError;

        if (!ticketData) {
          setError(t('checkout.notFound', lang));
          return;
        }

        if (ticketData.status === 'reserved') {
          if (ticketData.reserved_until && new Date(ticketData.reserved_until) < new Date()) {
            setError(t('checkout.expired', lang));
            return;
          }
          if (ticketData.reserved_for !== authUser.id) {
            setError(t('checkout.otherBuyer', lang));
            return;
          }

          const { data: bidData } = await supabase
            .from('bids')
            .select('id, bid_price')
            .eq('ticket_id', ticketData.id)
            .eq('user_id', authUser.id)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          setAcceptedBid(bidData ?? null);
        } else if (ticketData.status !== 'available') {
          setError(t('checkout.unavailable', lang));
          return;
        }

        // TODO: verwijder deze tijdelijke bypass voor productie
        // if (ticketData.user_id === authData.user.id) {
        //   setError('Je kunt je eigen ticket niet kopen.');
        //   return;
        // }

        setTicket(ticketData);
        setSelectedTickets([ticketData]);
      } catch (err) {
        console.error('Error loading checkout:', err);
        setError(t('checkout.loadError', lang));
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [id, lang, queryString, router]);

  useEffect(() => {
    if (!ticket || ticket.status !== 'reserved' || !ticket.reserved_until) return;

    function update() {
      const diff = new Date(ticket.reserved_until) - Date.now();
      if (diff <= 0) {
        setTimeLeft(t('checkout.expiredLabel', lang));
        setError(t('checkout.expiredMsg', lang));
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}u ${m}m ${s}s`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [ticket, lang]);

  const isReservedForMe =
    selectedTickets.length === 1 &&
    ticket?.status === 'reserved' &&
    ticket?.reserved_for === user?.id;
  const effectivePrices = selectedTickets.map((selectedTicket) =>
    isReservedForMe && acceptedBid
      ? Number(acceptedBid.bid_price)
      : Number(selectedTicket?.ask_price)
  );

  const handlePay = async () => {
    if (!ticket || !user || selectedTickets.length === 0) return;

    setPaying(true);
    setError(null);

    try {
      const body =
        selectedTickets.length > 1
          ? { ticketIds: selectedTickets.map((selectedTicket) => selectedTicket.id) }
          : { ticketId: ticket.id };
      if (selectedTickets.length === 1 && isReservedForMe && acceptedBid) {
        body.bidId = acceptedBid.id;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('checkout.payError', lang));
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || t('checkout.payGenericError', lang));
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <p className="text-sm text-slate-500">{t('checkout.loading', lang)}</p>
      </div>
    );
  }

  if (error && selectedTickets.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-center text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!ticket || selectedTickets.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <p className="text-sm text-slate-500">{t('checkout.loading', lang)}</p>
      </div>
    );
  }

  const ticketSubtotal = effectivePrices.reduce((sum, price) => sum + Number(price || 0), 0);
  const fee = effectivePrices.reduce((sum, price) => sum + calculateServiceFee(price), 0);
  const total = effectivePrices.reduce((sum, price) => sum + calculateBuyerTotal(price), 0);
  const isExpired = timeLeft === t('checkout.expiredLabel', lang);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t('checkout.title', lang)}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('checkout.subtitle', lang)}
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {isReservedForMe && !isExpired && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            {t('checkout.bidAccepted', lang)} <span className="font-semibold">{timeLeft}</span> {t('checkout.bidAcceptedSuffix', lang)}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            {t('checkout.overview', lang)}
          </h2>

          {ticket.event_name && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600 text-xs">
                🎫
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{ticket.event_name}</p>
                {ticket.event_date && (
                  <p className="text-xs text-slate-500">
                    {new Date(ticket.event_date).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 text-sm">
            {selectedTickets.length > 1 && (
              <div className="flex justify-between">
                <span className="text-slate-600">{t('checkout.ticketCount', lang)}</span>
                <span className="font-medium text-slate-900">{selectedTickets.length}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">
                {isReservedForMe
                  ? t('checkout.acceptedBid', lang)
                  : selectedTickets.length > 1
                    ? t('checkout.ticketPriceTotal', lang)
                    : t('checkout.ticketPrice', lang)}
              </span>
              <span className="font-medium text-slate-900">
                € {formatPrice(ticketSubtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                {selectedTickets.length > 1 ? t('checkout.serviceFeesTotal', lang) : t('checkout.serviceFees', lang)}
              </span>
              <span className="font-medium text-slate-900">
                € {formatPrice(fee)}
              </span>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">{t('checkout.total', lang)}</span>
                <span className="text-lg font-semibold text-emerald-700">
                  € {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            {t('checkout.sellerReceives', lang)} € {formatPrice(ticketSubtotal)}. {t('checkout.buyerPays', lang)} € {formatPrice(fee)} {t('checkout.buyerPaysSuffix', lang)}
          </p>
        </section>

        <div className="mt-6">
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || isExpired}
            className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {paying
              ? t('checkout.processing', lang)
              : isExpired
                ? t('checkout.reservationExpired', lang)
                : `${t('checkout.payBtn', lang)} € ${formatPrice(total)}`}
          </button>
        </div>
      </main>
    </div>
  );
}
