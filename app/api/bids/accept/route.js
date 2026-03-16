import { createClient } from '@supabase/supabase-js';
import { calculateBuyerTotal } from '@/lib/fees';
import { sendBidAcceptedEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resolveUserFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}

async function expirePendingBids() {
  await supabaseAdmin
    .from('bids')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString());
}

function getBaseUrl(request) {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    request.headers.get('origin') ||
    request.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
    'http://localhost:3000'
  );
}

async function getBidderProfile(userId) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return { email: null, name: null };
  const user = data.user;
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : null);
  return { email: user.email || null, name: name || null };
}

export async function POST(request) {
  try {
    const actor = await resolveUserFromRequest(request);
    if (!actor?.id) {
      return Response.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
    }

    await expirePendingBids();

    const { bidId } = await request.json();
    if (!bidId) {
      return Response.json({ error: 'bidId is verplicht.' }, { status: 400 });
    }

    const { data: bid, error: bidError } = await supabaseAdmin
      .from('bids')
      .select('id, ticket_id, event_id, event_day_id, bid_price, user_id, status')
      .eq('id', bidId)
      .single();

    if (bidError || !bid) {
      return Response.json({ error: 'Bod niet gevonden.' }, { status: 404 });
    }

    if (bid.status !== 'pending') {
      return Response.json({ error: 'Dit bod is niet meer actief.' }, { status: 409 });
    }

    let ticket = null;
    if (bid.ticket_id) {
      const { data: directTicket } = await supabaseAdmin
        .from('tickets')
        .select('id, user_id, event_id, event_day_id, event_name, ask_price, status, reserved_for, reserved_until')
        .eq('id', bid.ticket_id)
        .single();
      ticket = directTicket;
    } else if (bid.event_day_id != null || bid.event_id != null) {
      let ticketQuery = supabaseAdmin
        .from('tickets')
        .select('id, user_id, event_id, event_day_id, event_name, ask_price, status, reserved_for, reserved_until')
        .eq('user_id', actor.id)
        .eq('status', 'available')
        .order('id', { ascending: true })
        .limit(1);

      if (bid.event_day_id != null) {
        ticketQuery = ticketQuery.eq('event_day_id', bid.event_day_id);
      } else {
        ticketQuery = ticketQuery.eq('event_id', bid.event_id);
      }

      const { data: availableTicket } = await ticketQuery.maybeSingle();
      ticket = availableTicket;
    }

    if (!ticket?.id) {
      return Response.json({ error: 'Geen beschikbaar ticket gevonden voor dit bod.' }, { status: 404 });
    }

    if (ticket.user_id !== actor.id) {
      return Response.json({ error: 'Je mag dit bod niet accepteren.' }, { status: 403 });
    }

    if (
      ticket.status === 'reserved' &&
      ticket.reserved_for &&
      ticket.reserved_for !== bid.user_id &&
      ticket.reserved_until &&
      new Date(ticket.reserved_until).getTime() > Date.now()
    ) {
      return Response.json({ error: 'Ticket is al gereserveerd voor een andere koper.' }, { status: 409 });
    }

    const bidPrice = Number(bid.bid_price);
    if (!Number.isFinite(bidPrice) || bidPrice <= 0) {
      return Response.json({ error: 'Ongeldig bodbedrag.' }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error: acceptError } = await supabaseAdmin
      .from('bids')
      .update({
        status: 'accepted',
        ticket_id: ticket.id,
        event_day_id: ticket.event_day_id ?? bid.event_day_id ?? null,
        event_id: ticket.event_id ?? bid.event_id ?? null,
        expires_at: expiresAt,
      })
      .eq('id', bid.id)
      .eq('status', 'pending');

    if (acceptError) {
      return Response.json({ error: 'Bod accepteren mislukt.' }, { status: 500 });
    }

    await supabaseAdmin
      .from('bids')
      .update({ status: 'rejected' })
      .eq('ticket_id', ticket.id)
      .neq('id', bid.id)
      .eq('status', 'pending');

    const { error: ticketUpdateError } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'reserved',
        reserved_for: bid.user_id,
        reserved_until: expiresAt,
      })
      .eq('id', ticket.id);

    if (ticketUpdateError) {
      return Response.json({ error: 'Ticket reserveren mislukt.' }, { status: 500 });
    }

    const mollieApiKey = process.env.MOLLIE_API_KEY;
    if (!mollieApiKey) {
      return Response.json({ error: 'Betalingsconfiguratie ontbreekt.' }, { status: 500 });
    }

    const totalAmount = calculateBuyerTotal(bidPrice);
    const baseUrl = getBaseUrl(request);
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    const molliePayload = {
      amount: {
        currency: 'EUR',
        value: totalAmount.toFixed(2),
      },
      description: `Tckr – Bod geaccepteerd #${bid.id}`,
      redirectUrl: `${baseUrl}/betaling/succes`,
      expiresAt,
      metadata: {
        ticketId: String(ticket.id),
        buyerId: String(bid.user_id),
        bidId: String(bid.id),
      },
    };

    if (!isLocalhost) {
      molliePayload.webhookUrl = `${baseUrl}/api/payments/webhook`;
    }

    const mollieRes = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mollieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(molliePayload),
    });

    const mollieData = await mollieRes.json();
    const checkoutUrl = mollieData?._links?.checkout?.href || null;
    if (!mollieRes.ok || !checkoutUrl) {
      console.error('[Bids Accept] Mollie create payment failed:', mollieData);
      return Response.json(
        { error: mollieData?.detail || 'Betalingslink aanmaken mislukt.' },
        { status: 502 }
      );
    }

    const bidder = await getBidderProfile(bid.user_id);
    if (bidder.email) {
      await sendBidAcceptedEmail(
        bidder.email,
        bidder.name,
        ticket.event_name || 'Onbekend evenement',
        bidPrice,
        checkoutUrl
      );
    }

    return Response.json({
      success: true,
      checkoutUrl,
      reservedUntil: expiresAt,
      ticketId: ticket.id,
    });
  } catch (error) {
    console.error('[Bids Accept] Unexpected error:', error);
    return Response.json({ error: 'Er ging iets mis bij het accepteren van het bod.' }, { status: 500 });
  }
}
