'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { calculateServiceFee, calculateBuyerTotal, formatPrice } from '@/lib/fees';

export default function CheckoutPage() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [acceptedBid, setAcceptedBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.replace('/login');
          return;
        }
        setUser(authData.user);

        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('id, pdf_url, ask_price, status, user_id, event_name, event_date, reserved_for, reserved_until')
          .eq('id', id)
          .single();

        if (ticketError) throw ticketError;

        if (!ticketData) {
          setError('Ticket niet gevonden.');
          return;
        }

        if (ticketData.status === 'reserved') {
          if (ticketData.reserved_until && new Date(ticketData.reserved_until) < new Date()) {
            setError('De reservering voor dit ticket is verlopen.');
            return;
          }
          if (ticketData.reserved_for !== authData.user.id) {
            setError('Dit ticket is gereserveerd voor een andere koper.');
            return;
          }

          const { data: bidData } = await supabase
            .from('bids')
            .select('id, bid_price')
            .eq('ticket_id', ticketData.id)
            .eq('user_id', authData.user.id)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          setAcceptedBid(bidData ?? null);
        } else if (ticketData.status !== 'available') {
          setError('Dit ticket is niet meer beschikbaar.');
          return;
        }

        // TODO: verwijder deze tijdelijke bypass voor productie
        // if (ticketData.user_id === authData.user.id) {
        //   setError('Je kunt je eigen ticket niet kopen.');
        //   return;
        // }

        setTicket(ticketData);
      } catch (err) {
        console.error('Error loading checkout:', err);
        setError('Er ging iets mis bij het laden van de checkout.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [id, router]);

  useEffect(() => {
    if (!ticket || ticket.status !== 'reserved' || !ticket.reserved_until) return;

    function update() {
      const diff = new Date(ticket.reserved_until) - Date.now();
      if (diff <= 0) {
        setTimeLeft('Verlopen');
        setError('De reservering is verlopen. Je kunt dit ticket niet meer kopen.');
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
  }, [ticket]);

  const isReservedForMe = ticket?.status === 'reserved' && ticket?.reserved_for === user?.id;
  const effectivePrice = isReservedForMe && acceptedBid ? Number(acceptedBid.bid_price) : Number(ticket?.ask_price);

  const handlePay = async () => {
    if (!ticket || !user) return;

    setPaying(true);
    setError(null);

    try {
      const body = { ticketId: ticket.id };
      if (isReservedForMe && acceptedBid) {
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
        throw new Error(data.error || 'Betaling kon niet worden gestart.');
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Er ging iets mis bij het starten van de betaling.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <p className="text-sm text-slate-500">Bezig met laden...</p>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-center text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  const fee = calculateServiceFee(effectivePrice);
  const total = calculateBuyerTotal(effectivePrice);
  const isExpired = timeLeft === 'Verlopen';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Checkout
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Controleer je bestelling en ga verder met betalen.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {isReservedForMe && !isExpired && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Je bod is geaccepteerd! Betaal binnen <span className="font-semibold">{timeLeft}</span> om je ticket veilig te stellen.
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Overzicht
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
            <div className="flex justify-between">
              <span className="text-slate-600">
                {isReservedForMe ? 'Geaccepteerd bod' : 'Ticketprijs'}
              </span>
              <span className="font-medium text-slate-900">
                € {formatPrice(effectivePrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                Servicekosten
                <span className="ml-1 text-[11px] text-slate-400">
                  (€ 1,00 + 1,5%)
                </span>
              </span>
              <span className="font-medium text-slate-900">
                € {formatPrice(fee)}
              </span>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Totaal</span>
                <span className="text-lg font-semibold text-emerald-700">
                  € {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            De verkoper ontvangt € {formatPrice(effectivePrice)}. De servicekosten van € {formatPrice(fee)} zijn voor rekening van de koper.
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
              ? 'Bezig met verwerken...'
              : isExpired
                ? 'Reservering verlopen'
                : `Betaal € ${formatPrice(total)}`}
          </button>
        </div>
      </main>
    </div>
  );
}
